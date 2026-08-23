import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, mangaId: string) {
    // Vérifier que le manga existe
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { id: true },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    // Vérifier si déjà en favori
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_mangaId: {
          userId,
          mangaId,
        },
      },
    });

    if (existing) {
      // Supprimer des favoris
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });
      return { isFavorite: false };
    }

    // Ajouter aux favoris
    await this.prisma.favorite.create({
      data: { userId, mangaId },
    });
    return { isFavorite: true };
  }

  async check(userId: string, mangaId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_mangaId: {
          userId,
          mangaId,
        },
      },
    });
    return { isFavorite: !!favorite };
  }

  async getUserFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        manga: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            _count: {
              select: {
                chapters: true,
                likes: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
