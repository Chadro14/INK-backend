import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // AJOUTER UN LIKE
  // ============================================
  async like(userId: string, mangaId: string, chapterId?: string) {
    // Vérifier que le manga existe
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    // Vérifier si le like existe déjà
    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        mangaId,
        ...(chapterId && { chapterId }),
      },
    });

    if (existingLike) {
      // Si le like existe déjà, on le supprime (toggle)
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });

      // Décrémenter le compteur
      await this.prisma.manga.update({
        where: { id: mangaId },
        data: { likesCount: { decrement: 1 } },
      });

      return { liked: false };
    }

    // Créer le like
    await this.prisma.like.create({
      data: {
        userId,
        mangaId,
        chapterId: chapterId || null,
      },
    });

    // Incrémenter le compteur
    await this.prisma.manga.update({
      where: { id: mangaId },
      data: { likesCount: { increment: 1 } },
    });

    return { liked: true };
  }

  // ============================================
  // VÉRIFIER SI UN UTILISATEUR A LIKÉ
  // ============================================
  async hasLiked(userId: string, mangaId: string, chapterId?: string) {
    const like = await this.prisma.like.findFirst({
      where: {
        userId,
        mangaId,
        ...(chapterId && { chapterId }),
      },
    });

    return !!like;
  }

  // ============================================
  // COMPTER LES LIKES D'UN MANGA
  // ============================================
  async countLikes(mangaId: string) {
    return this.prisma.like.count({
      where: { mangaId },
    });
  }
}