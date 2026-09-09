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
          // Signer l'URL de la vidéo si ce n'est pas déjà une URL publique
          if (!reel.videoUrl.startsWith('http://') && !reel.videoUrl.startsWith('https://')) {
            signedVideoUrl = await this.storage.getSignedUrl(
              reel.videoUrl,
              3600 * 24, // 24 heures
              'reels'
            );
          }

          if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http://') && !reel.thumbnailUrl.startsWith('https://')) {
            signedThumbnailUrl = await this.storage.getSignedUrl(
              reel.thumbnailUrl,
              3600 * 24 * 7, // 7 jours
              'reels'
            );
          }
        } catch (error) {
          console.error('Erreur signature URL reel:', error);
        }

        // Vérifier si l'utilisateur a liké
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
          'reels'
        );
      }

      if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http://') && !reel.thumbnailUrl.startsWith('https://')) {
        signedThumbnailUrl = await this.storage.getSignedUrl(
          reel.thumbnailUrl,
          3600 * 24 * 7,
          'reels'
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

    // Supprimer les fichiers du storage
    try {
      if (reel.videoUrl && !reel.videoUrl.startsWith('http')) {
        await this.storage.delete(reel.videoUrl, 'reels');
      }
      if (reel.thumbnailUrl && !reel.thumbnailUrl.startsWith('http')) {
        await this.storage.delete(reel.thumbnailUrl, 'reels');
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
      // Déjà liké
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
    const upload = await this.storage.getUploadUrl(key, 'reels');
    return { key, ...upload };
  }
}
