import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type IncrementViewDto = {
  userId: string | null;
  mangaId: string;
  chapterId: string | null;
  sessionId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
};

@Injectable()
export class ViewsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // INCRÉMENTER UNE VUE (1 VUE = 1 PERSONNE)
  // ============================================
  async increment(dto: IncrementViewDto) {
    const { userId, mangaId, chapterId, sessionId, userAgent, ipAddress } = dto;

    // ✅ 1. Vérifier si la vue existe déjà (avec userId ou sessionId)
    const existing = await this.prisma.view.findFirst({
      where: {
        mangaId,
        chapterId: chapterId || null,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    // ✅ 2. Si déjà vu, on ne re-compte pas (MÉTHODE TIKTOK)
    if (existing) {
      // On retourne le compteur actuel sans l'incrémenter
      let viewsCount: number;
      if (chapterId) {
        const chapter = await this.prisma.chapter.findUnique({
          where: { id: chapterId },
          select: { viewsCount: true },
        });
        viewsCount = chapter?.viewsCount || 0;
      } else {
        const manga = await this.prisma.manga.findUnique({
          where: { id: mangaId },
          select: { viewsCount: true },
        });
        viewsCount = manga?.viewsCount || 0;
      }

      return {
        counted: false,
        message: 'Déjà vu - pas de re-comptage (méthode TikTok)',
        viewsCount,
      };
    }

    // ✅ 3. Créer la vue (première fois)
    await this.prisma.view.create({
      data: {
        userId,
        mangaId,
        chapterId: chapterId || null,
        sessionId: sessionId || null,
        userAgent,
        ipAddress,
      },
    });

    // ✅ 4. Incrémenter le compteur
    let viewsCount: number;

    if (chapterId) {
      const updated = await this.prisma.chapter.update({
        where: { id: chapterId },
        data: { viewsCount: { increment: 1 } },
        select: { viewsCount: true },
      });
      viewsCount = updated.viewsCount;
    } else {
      const updated = await this.prisma.manga.update({
        where: { id: mangaId },
        data: { viewsCount: { increment: 1 } },
        select: { viewsCount: true },
      });
      viewsCount = updated.viewsCount;
    }

    return {
      counted: true,
      message: 'Vue comptabilisée (1ère visite)',
      viewsCount,
    };
  }

  // ============================================
  // VÉRIFIER SI DÉJÀ VU (pour utilisateur connecté)
  // ============================================
  async check(userId: string, mangaId: string, chapterId: string | null) {
    const existing = await this.prisma.view.findFirst({
      where: {
        userId,
        mangaId,
        chapterId: chapterId || null,
      },
    });

    return { hasViewed: !!existing };
  }

  // ============================================
  // COMPTER LES VUES D'UN MANGA
  // ============================================
  async getMangaViewsCount(mangaId: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { viewsCount: true },
    });
    return manga?.viewsCount || 0;
  }

  // ============================================
  // COMPTER LES VUES D'UN CHAPITRE
  // ============================================
  async getChapterViewsCount(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { viewsCount: true },
    });
    return chapter?.viewsCount || 0;
  }
}
