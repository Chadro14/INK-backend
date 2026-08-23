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
      select: { id: true, likesCount: true },
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
      // ✅ SUPPRIMER LE LIKE
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });

      // ✅ Décrémenter le compteur et récupérer la nouvelle valeur
      const updated = await this.prisma.manga.update({
        where: { id: mangaId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      // ✅ RETOURNER LE NOUVEAU COMPTEUR
      return { 
        liked: false, 
        likesCount: updated.likesCount 
      };
    }

    // ✅ CRÉER LE LIKE
    await this.prisma.like.create({
      data: {
        userId,
        mangaId,
        chapterId: chapterId || null,
      },
    });

    // ✅ Incrémenter le compteur et récupérer la nouvelle valeur
    const updated = await this.prisma.manga.update({
      where: { id: mangaId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    // ✅ RETOURNER LE NOUVEAU COMPTEUR
    return { 
      liked: true, 
      likesCount: updated.likesCount 
    };
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

    return { liked: !!like };
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
