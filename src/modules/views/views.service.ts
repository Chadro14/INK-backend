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
  // INCRÉMENTER UNE VUE
  // ============================================
  async increment(dto: IncrementViewDto) {
    const { userId, mangaId, chapterId, sessionId, userAgent, ipAddress } = dto;

    // 1. Vérifier si la vue existe déjà
    const existing = await this.prisma.view.findFirst({
      where: {
        mangaId,
        chapterId: chapterId || null,
        ...(userId ? { userId } : { sessionId }),
      },
    });

    // 2. Si déjà vu, ne pas recompter
    if (existing) {
      return { 
        counted: false, 
        message: 'Déjà vu',
        viewsCount: chapterId 
          ? await this.getChapterViewsCount(mangaId, chapterId)
          : await this.getMangaViewsCount(mangaId),
      };
    }

    // 3. Créer la vue
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

    // 4. Incrémenter le compteur
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
      message: 'Vue comptabilisée',
      viewsCount,
    };
  }

  // ============================================
  // VÉRIFIER SI DÉJÀ VU
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
  async getChapterViewsCount(mangaId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { viewsCount: true },
    });
    return chapter?.viewsCount || 0;
  }
}
