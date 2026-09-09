import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { ReelStatus } from '@prisma/client';
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

@Injectable()
export class ReelsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ============================================
  // 1. CRÉER UN REEL
  // ============================================
  async create(userId: string, dto: CreateReelDto) {
    return this.prisma.reel.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || null,
        duration: dto.duration || null,
        musicTitle: dto.musicTitle || null,
        musicArtist: dto.musicArtist || null,
        tags: dto.tags || [],
        isPrivate: dto.isPrivate || false,
        authorId: userId,
        publishedAt: new Date(),
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 2. RÉCUPÉRER LE FEED (TikTok style)
  // ============================================
  async getFeed(
    userId?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const where = {
      status: ReelStatus.PUBLISHED,
      isPrivate: false,
    };

    const [reels, total] = await Promise.all([
      this.prisma.reel.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: { select: AUTHOR_SELECT },
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

    // Signer les URLs vidéo (pour Supabase)
    const signedReels = await Promise.all(
      reels.map(async (reel) => {
        let signedVideoUrl = reel.videoUrl;
        let signedThumbnailUrl = reel.thumbnailUrl;

        try {
          if (!reel.videoUrl.startsWith('http://') && !reel.videoUrl.startsWith('https://')) {
            signedVideoUrl = await this.storage.getSignedUrl(
              reel.videoUrl,
              3600 * 24,
              'chapters'
            );
          }

          if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http://') && !reel.thumbnailUrl.startsWith('https://')) {
            signedThumbnailUrl = await this.storage.getSignedUrl(
              reel.thumbnailUrl,
              3600 * 24 * 7,
              'chapters'
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
      })
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
        author: { select: AUTHOR_SELECT },
        _count: {
          select: {
            likes: true,
            comments: true,
            views: true,
          },
        },
        likes: userId ? {
          where: { userId },
          select: { userId: true },
        } : false,
        bookmarks: userId ? {
          where: { userId },
          select: { userId: true },
        } : false,
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
      if (!reel.videoUrl.startsWith('http://') && !reel.videoUrl.startsWith('https://')) {
        signedVideoUrl = await this.storage.getSignedUrl(
          reel.videoUrl,
          3600 * 24,
          'chapters'
        );
      }

      if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http://') && !reel.thumbnailUrl.startsWith('https://')) {
        signedThumbnailUrl = await this.storage.getSignedUrl(
          reel.thumbnailUrl,
          3600 * 24 * 7,
          'chapters'
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

    return this.prisma.reel.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl,
        duration: dto.duration,
        musicTitle: dto.musicTitle,
        musicArtist: dto.musicArtist,
        tags: dto.tags,
        isPrivate: dto.isPrivate,
        status: dto.status,
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
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
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    try {
      await this.prisma.reelLike.create({
        data: {
          userId,
          reelId,
        },
      });

      await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { increment: 1 } },
      });

      return { liked: true };
    } catch (error) {
      await this.prisma.reelLike.delete({
        where: {
          userId_reelId: {
            userId,
            reelId,
          },
        },
      });

      await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { decrement: 1 } },
      });

      return { liked: false };
    }
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

    try {
      await this.prisma.reelBookmark.create({
        data: {
          userId,
          reelId,
        },
      });
      return { bookmarked: true };
    } catch (error) {
      await this.prisma.reelBookmark.delete({
        where: {
          userId_reelId: {
            userId,
            reelId,
          },
        },
      });
      return { bookmarked: false };
    }
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
      ...(viewerId !== userId ? { isPrivate: false, status: ReelStatus.PUBLISHED } : {}),
    };

    const reels = await this.prisma.reel.findMany({
      where,
      include: {
        author: { select: AUTHOR_SELECT },
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
  async addComment(reelId: string, userId: string, content: string, parentId?: string) {
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
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException('Commentaire parent non trouvé');
      }
    }

    const comment = await this.prisma.reelComment.create({
      data: {
        content,
        userId,
        reelId,
        parentId: parentId || null,
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
  // 12. RÉCUPÉRER LES COMMENTAIRES D'UN REEL
  // ============================================
  async getComments(reelId: string, userId?: string) {
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    const comments = await this.prisma.reelComment.findMany({
      where: {
        reelId,
        parentId: null,
      },
      include: {
        user: { select: AUTHOR_SELECT },
        replies: {
          include: {
            user: { select: AUTHOR_SELECT },
            _count: {
              select: { commentLikes: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { commentLikes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let userLikes: string[] = [];
    if (userId) {
      const likes = await this.prisma.reelCommentLike.findMany({
        where: { userId },
        select: { commentId: true },
      });
      userLikes = likes.map((l) => l.commentId);
    }

    return comments.map((comment) => ({
      ...comment,
      isLiked: userLikes.includes(comment.id),
      likesCount: comment._count.commentLikes,
      replies: comment.replies.map((reply) => ({
        ...reply,
        isLiked: userLikes.includes(reply.id),
        likesCount: reply._count.commentLikes,
      })),
    }));
  }

  // ============================================
  // 13. LIKER UN COMMENTAIRE DE REEL
  // ============================================
  async likeComment(commentId: string, userId: string) {
    const comment = await this.prisma.reelComment.findUnique({
      where: { id: commentId },
      select: { id: true, reelId: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    try {
      await this.prisma.reelCommentLike.create({
        data: {
          userId,
          commentId,
        },
      });

      await this.prisma.reelComment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      });

      return { liked: true };
    } catch (error) {
      await this.prisma.reelCommentLike.delete({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      await this.prisma.reelComment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
      });

      return { liked: false };
    }
  }

  // ============================================
  // 14. SUPPRIMER UN COMMENTAIRE
  // ============================================
  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.reelComment.findUnique({
      where: { id: commentId },
      select: { userId: true, reelId: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce commentaire');
    }

    // Supprimer les réponses d'abord
    await this.prisma.reelComment.deleteMany({
      where: { parentId: commentId },
    });

    await this.prisma.reelComment.delete({
      where: { id: commentId },
    });

    await this.prisma.reel.update({
      where: { id: comment.reelId },
      data: { commentsCount: { decrement: 1 } },
    });

    return { message: 'Commentaire supprimé' };
  }

  // ============================================
  // 15. VÉRIFIER SI L'UTILISATEUR A LIKÉ UN COMMENTAIRE
  // ============================================
  async hasLikedComment(commentId: string, userId: string) {
    const like = await this.prisma.reelCommentLike.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    return { isLiked: !!like };
  }
}
