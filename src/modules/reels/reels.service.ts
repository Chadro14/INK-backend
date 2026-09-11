import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { ReelStatus, ReelType } from '@prisma/client';
import { CreateReelDto } from './dto/create-reel.dto';
import { UpdateReelDto } from './dto/update-reel.dto';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  avatarColor: true,
  isCertified: true,
  badgeColor: true,
};

// ✅ Relations à inclure pour le feed/détail
const REEL_RELATIONS = {
  author: { select: AUTHOR_SELECT },
  manga: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverUrl: true,
    },
  },
  chapter: {
    select: {
      id: true,
      number: true,
      title: true,
      mangaId: true,
    },
  },
  event: {
    select: {
      id: true,
      title: true,
      type: true,
      coverUrl: true,
    },
  },
  featuredCreator: { select: AUTHOR_SELECT },
};

@Injectable()
export class ReelsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ============================================
  // 1. CRÉER UN REEL
  // ✅ Gère : trim, scheduledAt, mentions + notifications
  // ============================================
  async create(userId: string, dto: CreateReelDto) {
    // ✅ Vérifications des liens si fournis
    if (dto.mangaId) {
      const manga = await this.prisma.manga.findUnique({
        where: { id: dto.mangaId },
        select: { id: true },
      });
      if (!manga) throw new BadRequestException('Manga non trouvé');
    }

    if (dto.chapterId) {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id: dto.chapterId },
        select: { id: true },
      });
      if (!chapter) throw new BadRequestException('Chapitre non trouvé');
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
        select: { id: true },
      });
      if (!event) throw new BadRequestException('Événement non trouvé');
    }

    if (dto.featuredCreatorId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: dto.featuredCreatorId },
        select: { id: true },
      });
      if (!creator) throw new BadRequestException('Créateur non trouvé');
    }

    // ✅ Déterminer le statut (programmé ou publié)
    let status: ReelStatus = ReelStatus.PUBLISHED;
    let publishedAt: Date | null = new Date();

    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt);
      if (scheduledDate > new Date()) {
        status = ReelStatus.SCHEDULED;
        publishedAt = null;
      }
    }

    // ✅ Créer le Reel
    const reel = await this.prisma.reel.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || null,
        duration: dto.duration || null,

        // ✅ Trim virtuel
        trimStart: dto.trimStart ?? 0,
        trimEnd: dto.trimEnd ?? null,

        musicTitle: dto.musicTitle || null,
        musicArtist: dto.musicArtist || null,
        tags: dto.tags || [],
        isPrivate: dto.isPrivate || false,
        authorId: userId,

        // ✅ Statut & programmation
        status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        publishedAt,

        // ✅ Nouveaux champs
        type: dto.type || ReelType.OTHER,
        ctaLabel: dto.ctaLabel || null,
        mangaId: dto.mangaId || null,
        chapterId: dto.chapterId || null,
        eventId: dto.eventId || null,
        featuredCreatorId: dto.featuredCreatorId || null,
      },
      include: REEL_RELATIONS,
    });

    // ✅ Créer les mentions + notifications
    if (dto.mentionIds && dto.mentionIds.length > 0) {
      // Filtrer : ne pas se mentionner soi-même + éviter les doublons
      const uniqueMentionIds = Array.from(new Set(dto.mentionIds)).filter(
        (id) => id !== userId,
      );

      if (uniqueMentionIds.length > 0) {
        // Créer les mentions
        await this.prisma.reelMention.createMany({
          data: uniqueMentionIds.map((mentionId) => ({
            reelId: reel.id,
            userId: mentionId,
          })),
          skipDuplicates: true,
        });

        // Envoyer une notification à chaque mentionné
        await Promise.all(
          uniqueMentionIds.map((mentionId) =>
            this.prisma.notification.create({
              data: {
                userId: mentionId,
                type: 'SYSTEM',
                title: 'Vous avez été mentionné',
                body: `@${reel.author.username} vous a mentionné dans un Reel`,
                link: `/reels/${reel.id}`,
                metadata: { reelId: reel.id, fromUserId: userId },
              },
            }),
          ),
        );
      }
    }

    return reel;
  }

  // ============================================
  // 2. RÉCUPÉRER LE FEED (TikTok style)
  // ============================================
  async getFeed(
    userId?: string,
    page: number = 1,
    limit: number = 10,
    filters?: {
      type?: ReelType;
      mangaId?: string;
      eventId?: string;
    },
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      status: ReelStatus.PUBLISHED,
      isPrivate: false,
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.mangaId) where.mangaId = filters.mangaId;
    if (filters?.eventId) where.eventId = filters.eventId;

    const [reels, total] = await Promise.all([
      this.prisma.reel.findMany({
        where,
        skip,
        take: limit,
        include: {
          ...REEL_RELATIONS,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reel.count({ where }),
    ]);

    // Signer les URLs vidéo
    const signedReels = await Promise.all(
      reels.map(async (reel) => {
        let signedVideoUrl = reel.videoUrl;
        let signedThumbnailUrl = reel.thumbnailUrl;

        try {
          if (
            !reel.videoUrl.startsWith('http://') &&
            !reel.videoUrl.startsWith('https://')
          ) {
            signedVideoUrl = await this.storage.getSignedUrl(
              reel.videoUrl,
              3600 * 24,
              'chapters',
            );
          }

          if (
            reel.thumbnailUrl &&
            !reel.thumbnailUrl.startsWith('http://') &&
            !reel.thumbnailUrl.startsWith('https://')
          ) {
            signedThumbnailUrl = await this.storage.getSignedUrl(
              reel.thumbnailUrl,
              3600 * 24 * 7,
              'chapters',
            );
          }
        } catch (error) {
          console.error('Erreur signature URL reel:', error);
        }

        let isLiked = false;
        let isBookmarked = false;

        if (userId) {
          const [like, bookmark] = await Promise.all([
            this.prisma.reelLike.findUnique({
              where: {
                userId_reelId: {
                  userId,
                  reelId: reel.id,
                },
              },
            }),
            this.prisma.reelBookmark.findUnique({
              where: {
                userId_reelId: {
                  userId,
                  reelId: reel.id,
                },
              },
            }),
          ]);
          isLiked = !!like;
          isBookmarked = !!bookmark;
        }

        return {
          ...reel,
          videoUrl: signedVideoUrl,
          thumbnailUrl: signedThumbnailUrl,
          likesCount: reel._count.likes,
          commentsCount: reel._count.comments,
          isLiked,
          isBookmarked,
        };
      }),
    );

    return {
      data: signedReels,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  // ============================================
  // 3. RÉCUPÉRER UN REEL PAR ID
  // ============================================
  async findById(id: string, userId?: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id },
      include: {
        ...REEL_RELATIONS,
        mentions: {
          include: {
            user: { select: AUTHOR_SELECT },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            views: true,
          },
        },
        likes: userId
          ? {
              where: { userId },
              select: { userId: true },
            }
          : false,
        bookmarks: userId
          ? {
              where: { userId },
              select: { userId: true },
            }
          : false,
      },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    if (reel.isPrivate && reel.authorId !== userId) {
      throw new ForbiddenException('Ce reel est privé');
    }

    let signedVideoUrl = reel.videoUrl;
    let signedThumbnailUrl = reel.thumbnailUrl;

    try {
      if (
        !reel.videoUrl.startsWith('http://') &&
        !reel.videoUrl.startsWith('https://')
      ) {
        signedVideoUrl = await this.storage.getSignedUrl(
          reel.videoUrl,
          3600 * 24,
          'chapters',
        );
      }

      if (
        reel.thumbnailUrl &&
        !reel.thumbnailUrl.startsWith('http://') &&
        !reel.thumbnailUrl.startsWith('https://')
      ) {
        signedThumbnailUrl = await this.storage.getSignedUrl(
          reel.thumbnailUrl,
          3600 * 24 * 7,
          'chapters',
        );
      }
    } catch (error) {
      console.error('Erreur signature URL reel:', error);
    }

    return {
      ...reel,
      videoUrl: signedVideoUrl,
      thumbnailUrl: signedThumbnailUrl,
      likesCount: reel._count.likes,
      commentsCount: reel._count.comments,
      viewsCount: reel._count.views,
      isLiked: userId ? reel.likes.length > 0 : false,
      isBookmarked: userId ? reel.bookmarks.length > 0 : false,
    };
  }

  // ============================================
  // 4. METTRE À JOUR UN REEL
  // ============================================
  async update(id: string, userId: string, dto: UpdateReelDto) {
    const reel = await this.prisma.reel.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    if (reel.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce reel');
    }

    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.videoUrl !== undefined) updateData.videoUrl = dto.videoUrl;
    if (dto.thumbnailUrl !== undefined) updateData.thumbnailUrl = dto.thumbnailUrl;
    if (dto.duration !== undefined) updateData.duration = dto.duration;
    if (dto.trimStart !== undefined) updateData.trimStart = dto.trimStart;
    if (dto.trimEnd !== undefined) updateData.trimEnd = dto.trimEnd;
    if (dto.musicTitle !== undefined) updateData.musicTitle = dto.musicTitle;
    if (dto.musicArtist !== undefined) updateData.musicArtist = dto.musicArtist;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.isPrivate !== undefined) updateData.isPrivate = dto.isPrivate;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.scheduledAt !== undefined) {
      updateData.scheduledAt = dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : null;
    }

    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.ctaLabel !== undefined) updateData.ctaLabel = dto.ctaLabel;
    if (dto.mangaId !== undefined) updateData.mangaId = dto.mangaId;
    if (dto.chapterId !== undefined) updateData.chapterId = dto.chapterId;
    if (dto.eventId !== undefined) updateData.eventId = dto.eventId;
    if (dto.featuredCreatorId !== undefined)
      updateData.featuredCreatorId = dto.featuredCreatorId;

    const updatedReel = await this.prisma.reel.update({
      where: { id },
      data: updateData,
      include: REEL_RELATIONS,
    });

    // ✅ Mettre à jour les mentions si fournies
    if (dto.mentionIds !== undefined) {
      // Supprimer les anciennes mentions
      await this.prisma.reelMention.deleteMany({
        where: { reelId: id },
      });

      // Créer les nouvelles mentions
      const uniqueMentionIds = Array.from(new Set(dto.mentionIds)).filter(
        (mentionId) => mentionId !== userId,
      );

      if (uniqueMentionIds.length > 0) {
        await this.prisma.reelMention.createMany({
          data: uniqueMentionIds.map((mentionId) => ({
            reelId: id,
            userId: mentionId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updatedReel;
  }

  // ============================================
  // 5. SUPPRIMER UN REEL
  // ============================================
  async delete(id: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id },
      select: { authorId: true, videoUrl: true, thumbnailUrl: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    if (reel.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce reel');
    }

    try {
      if (reel.videoUrl && !reel.videoUrl.startsWith('http')) {
        await this.storage.delete(reel.videoUrl, 'chapters');
      }
      if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http')) {
        await this.storage.delete(reel.thumbnailUrl, 'chapters');
      }
    } catch (error) {
      console.error('Erreur suppression fichiers:', error);
    }

    await this.prisma.reel.delete({ where: { id } });

    return { message: 'Reel supprimé avec succès' };
  }

  // ============================================
  // 6. LIKER UN REEL
  // ============================================
  async like(reelId: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true, likesCount: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    const existingLike = await this.prisma.reelLike.findUnique({
      where: {
        userId_reelId: {
          userId,
          reelId,
        },
      },
    });

    if (existingLike) {
      await this.prisma.reelLike.delete({
        where: { id: existingLike.id },
      });

      const updated = await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return { liked: false, likesCount: updated.likesCount };
    }

    await this.prisma.reelLike.create({
      data: { userId, reelId },
    });

    const updated = await this.prisma.reel.update({
      where: { id: reelId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    return { liked: true, likesCount: updated.likesCount };
  }

  // ============================================
  // 7. BOOKMARK UN REEL
  // ============================================
  async bookmark(reelId: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    const existing = await this.prisma.reelBookmark.findUnique({
      where: {
        userId_reelId: {
          userId,
          reelId,
        },
      },
    });

    if (existing) {
      await this.prisma.reelBookmark.delete({
        where: { id: existing.id },
      });
      return { isBookmarked: false };
    }

    await this.prisma.reelBookmark.create({
      data: { userId, reelId },
    });
    return { isBookmarked: true };
  }

  // ============================================
  // 8. COMPTER UNE VUE
  // ============================================
  async view(reelId: string, userId?: string, sessionId?: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true, authorId: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    if (userId && reel.authorId === userId) {
      return { viewsCount: 0 };
    }

    const existing = await this.prisma.reelView.findFirst({
      where: {
        reelId,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    if (existing) {
      return { viewsCount: 0 };
    }

    await this.prisma.reelView.create({
      data: {
        userId,
        reelId,
        sessionId: sessionId || null,
      },
    });

    const updated = await this.prisma.reel.update({
      where: { id: reelId },
      data: { viewsCount: { increment: 1 } },
      select: { viewsCount: true },
    });

    return { viewsCount: updated.viewsCount };
  }

  // ============================================
  // 9. RÉCUPÉRER LES REELS D'UN UTILISATEUR
  // ============================================
  async getUserReels(userId: string, viewerId?: string) {
    const where = {
      authorId: userId,
      ...(viewerId !== userId
        ? { isPrivate: false, status: ReelStatus.PUBLISHED }
        : {}),
    };

    const reels = await this.prisma.reel.findMany({
      where,
      include: {
        ...REEL_RELATIONS,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reels.map((reel) => ({
      ...reel,
      likesCount: reel._count.likes,
      commentsCount: reel._count.comments,
    }));
  }

  // ============================================
  // 10. URLS D'UPLOAD POUR VIDÉO
  // ============================================
  async getUploadUrl(userId: string, filename: string) {
    const key = `reels/${userId}/${Date.now()}-${filename}`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  // ============================================
  // 11. AJOUTER UN COMMENTAIRE
  // ============================================
  async addComment(
    reelId: string,
    userId: string,
    content: string,
    parentId?: string,
  ) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    if (parentId) {
      const parent = await this.prisma.reelComment.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('Commentaire parent non trouvé');
      }
      if (parent.reelId !== reelId) {
        throw new BadRequestException(
          'Le commentaire parent ne correspond pas à ce reel',
        );
      }
    }

    const comment = await this.prisma.reelComment.create({
      data: {
        userId,
        reelId,
        parentId: parentId || null,
        content,
      },
      include: {
        user: { select: AUTHOR_SELECT },
        _count: {
          select: { commentLikes: true },
        },
      },
    });

    await this.prisma.reel.update({
      where: { id: reelId },
      data: { commentsCount: { increment: 1 } },
    });

    return {
      ...comment,
      likesCount: comment._count.commentLikes,
      isLiked: false,
    };
  }

  // ============================================
  // 12. RÉCUPÉRER LES COMMENTAIRES
  // ============================================
  async getComments(
    reelId: string,
    userId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.reelComment.findMany({
        where: {
          reelId,
          parentId: null,
        },
        include: {
          user: { select: AUTHOR_SELECT },
          _count: {
            select: {
              commentLikes: true,
              replies: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reelComment.count({
        where: {
          reelId,
          parentId: null,
        },
      }),
    ]);

    const commentIds = comments.map((c) => c.id);
    const replies = await this.prisma.reelComment.findMany({
      where: {
        parentId: { in: commentIds },
      },
      include: {
        user: { select: AUTHOR_SELECT },
        _count: {
          select: { commentLikes: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const repliesByParent = replies.reduce(
      (acc, reply) => {
        const parentId = reply.parentId!;
        if (!acc[parentId]) acc[parentId] = [];
        acc[parentId].push(reply);
        return acc;
      },
      {} as Record<string, typeof replies>,
    );

    let userLikes: string[] = [];
    if (userId) {
      const likes = await this.prisma.reelCommentLike.findMany({
        where: { userId },
        select: { commentId: true },
      });
      userLikes = likes.map((l) => l.commentId);
    }

    const commentsWithReplies = comments.map((comment) => ({
      ...comment,
      isLiked: userLikes.includes(comment.id),
      likesCount: comment._count.commentLikes,
      repliesCount: comment._count.replies,
      replies: (repliesByParent[comment.id] || []).map((reply) => ({
        ...reply,
        isLiked: userLikes.includes(reply.id),
        likesCount: reply._count.commentLikes,
      })),
    }));

    return {
      data: commentsWithReplies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // 13. LIKER UN COMMENTAIRE
  // ============================================
  async likeComment(commentId: string, userId: string) {
    const comment = await this.prisma.reelComment.findUnique({
      where: { id: commentId },
      select: { id: true, likesCount: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    const existingLike = await this.prisma.reelCommentLike.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existingLike) {
      await this.prisma.reelCommentLike.delete({
        where: { id: existingLike.id },
      });

      const updated = await this.prisma.reelComment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return { liked: false, likesCount: updated.likesCount };
    }

    await this.prisma.reelComment
