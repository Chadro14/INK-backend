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

    // Signer les URLs vidéo
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
  // 6. LIKER UN REEL — ✅ ALIGNÉ sur LikesService
  // ============================================
  async like(reelId: string, userId: string) {
    // 1. Vérifier que le reel existe
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true, likesCount: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    // 2. Vérifier si le like existe déjà
    const existingLike = await this.prisma.reelLike.findUnique({
      where: {
        userId_reelId: {
          userId,
          reelId,
        },
      },
    });

    if (existingLike) {
      // ✅ SUPPRIMER LE LIKE
      await this.prisma.reelLike.delete({
        where: { id: existingLike.id },
      });

      // ✅ Décrémenter et récupérer la nouvelle valeur
      const updated = await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return {
        liked: false,
        likesCount: updated.likesCount,
      };
    }

    // ✅ CRÉER LE LIKE
    await this.prisma.reelLike.create({
      data: { userId, reelId },
    });

    // ✅ Incrémenter et récupérer la nouvelle valeur
    const updated = await this.prisma.reel.update({
      where: { id: reelId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    return {
      liked: true,
      likesCount: updated.likesCount,
    };
  }

  // ============================================
  // 7. BOOKMARK UN REEL — ✅ ALIGNÉ sur FavoritesService
  // ============================================
  async bookmark(reelId: string, userId: string) {
    // 1. Vérifier que le reel existe
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    // 2. Vérifier si déjà en bookmark
    const existing = await this.prisma.reelBookmark.findUnique({
      where: {
        userId_reelId: {
          userId,
          reelId,
        },
      },
    });

    if (existing) {
      // Supprimer des bookmarks
      await this.prisma.reelBookmark.delete({
        where: { id: existing.id },
      });
      return { isBookmarked: false };
    }

    // Ajouter aux bookmarks
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

    // Si l'auteur regarde son propre reel, ne pas compter
    if (userId && reel.authorId === userId) {
      return { viewsCount: 0 };
    }

    // Vérifier si déjà vu
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
  // 11. AJOUTER UN COMMENTAIRE — ✅ ALIGNÉ sur CommentsService
  // ============================================
  async addComment(reelId: string, userId: string, content: string, parentId?: string) {
    // 1. Vérifier que le reel existe
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    // 2. Vérifier le parent si présent
    if (parentId) {
      const parent = await this.prisma.reelComment.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new NotFoundException('Commentaire parent non trouvé');
      }
      if (parent.reelId !== reelId) {
        throw new BadRequestException('Le commentaire parent ne correspond pas à ce reel');
      }
    }

    // 3. Créer le commentaire
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

    // 4. Incrémenter le compteur du reel
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
  // 12. RÉCUPÉRER LES COMMENTAIRES — ✅ ALIGNÉ sur CommentsService
  // ============================================
  async getComments(
    reelId: string,
    userId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    // 1. Vérifier que le reel existe
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      select: { id: true },
    });

    if (!reel) {
      throw new NotFoundException('Reel non trouvé');
    }

    const skip = (page - 1) * limit;

    // 2. Récupérer les commentaires parents paginés
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

    // 3. Récupérer les réponses pour tous les commentaires parents
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

    // 4. Regrouper les réponses par parentId
    const repliesByParent = replies.reduce((acc, reply) => {
      const parentId = reply.parentId!;
      if (!acc[parentId]) acc[parentId] = [];
      acc[parentId].push(reply);
      return acc;
    }, {} as Record<string, typeof replies>);

    // 5. Vérifier si l'utilisateur a liké
    let userLikes: string[] = [];
    if (userId) {
      const likes = await this.prisma.reelCommentLike.findMany({
        where: { userId },
        select: { commentId: true },
      });
      userLikes = likes.map((l) => l.commentId);
    }

    // 6. Construire la réponse
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
  // 13. LIKER UN COMMENTAIRE — ✅ ALIGNÉ sur CommentsService.likeComment
  // ============================================
  async likeComment(commentId: string, userId: string) {
    // 1. Vérifier que le commentaire existe
    const comment = await this.prisma.reelComment.findUnique({
      where: { id: commentId },
      select: { id: true, likesCount: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    // 2. Vérifier si l'utilisateur a déjà liké
    const existingLike = await this.prisma.reelCommentLike.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existingLike) {
      // ✅ SUPPRIMER LE LIKE
      await this.prisma.reelCommentLike.delete({
        where: { id: existingLike.id },
      });

      // ✅ Décrémenter et récupérer la nouvelle valeur
      const updated = await this.prisma.reelComment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return {
        liked: false,
        likesCount: updated.likesCount,
      };
    }

    // ✅ AJOUTER LE LIKE
    await this.prisma.reelCommentLike.create({
      data: { userId, commentId },
    });

    // ✅ Incrémenter et récupérer la nouvelle valeur
    const updated = await this.prisma.reelComment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    return {
      liked: true,
      likesCount: updated.likesCount,
    };
  }

  // ============================================
  // 14. SUPPRIMER UN COMMENTAIRE — ✅ ALIGNÉ sur CommentsService.delete
  // ============================================
  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.reelComment.findUnique({
      where: { id: commentId },
      select: { userId: true, reelId: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    // Vérifier les droits : propriétaire OU ADMIN
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (comment.userId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce commentaire');
    }

    // Supprimer les réponses d'abord
    await this.prisma.reelComment.deleteMany({
      where: { parentId: commentId },
    });

    // Supprimer le commentaire
    await this.prisma.reelComment.delete({
      where: { id: commentId },
    });

    // Décrémenter le compteur du reel
    await this.prisma.reel.update({
      where: { id: comment.reelId },
      data: { commentsCount: { decrement: 1 } },
    });

    return { message: 'Commentaire supprimé avec succès' };
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
