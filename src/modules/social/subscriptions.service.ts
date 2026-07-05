import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // S'ABONNER À UN MANGA
  // ============================================
  async subscribe(userId: string, mangaId: string) {
    // Vérifier que le manga existe
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    // Vérifier si l'abonnement existe déjà
    const existing = await this.prisma.subscription.findUnique({
      where: {
        followerId_mangaId: {
          followerId: userId,
          mangaId,
        },
      },
    });

    if (existing) {
      // Si déjà abonné, on se désabonne (toggle)
      await this.prisma.subscription.delete({
        where: {
          followerId_mangaId: {
            followerId: userId,
            mangaId,
          },
        },
      });

      await this.prisma.manga.update({
        where: { id: mangaId },
        data: { subscribersCount: { decrement: 1 } },
      });

      return { subscribed: false };
    }

    // Créer l'abonnement
    await this.prisma.subscription.create({
      data: {
        followerId: userId,
        mangaId,
      },
    });

    await this.prisma.manga.update({
      where: { id: mangaId },
      data: { subscribersCount: { increment: 1 } },
    });

    return { subscribed: true };
  }

  // ============================================
  // VÉRIFIER SI UN UTILISATEUR EST ABONNÉ
  // ============================================
  async isSubscribed(userId: string, mangaId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        followerId_mangaId: {
          followerId: userId,
          mangaId,
        },
      },
    });

    return !!subscription;
  }

  // ============================================
  // RÉCUPÉRER LES ABONNEMENTS D'UN UTILISATEUR
  // ============================================
  async getUserSubscriptions(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { followerId: userId },
        include: {
          manga: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  avatarColor: true,
                  isCertified: true,
                },
              },
              _count: {
                select: {
                  chapters: {
                    where: { isDraft: false },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      data: subscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // RÉCUPÉRER LES ABONNÉS D'UN MANGA
  // ============================================
  async getMangaSubscribers(mangaId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { mangaId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({
        where: { mangaId },
      }),
    ]);

    return {
      data: subscribers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}