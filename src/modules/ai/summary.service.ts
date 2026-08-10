import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SummaryService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // SAUVEGARDER UN RÉSUMÉ
  // ============================================
  async saveSummary(chapterId: string, summary: string): Promise<void> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { summary },
    });
  }

  // ============================================
  // RÉCUPÉRER UN RÉSUMÉ
  // ============================================
  async getSummary(chapterId: string): Promise<string | null> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { summary: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    return chapter.summary;
  }

  // ============================================
  // SUPPRIMER UN RÉSUMÉ
  // ============================================
  async deleteSummary(chapterId: string): Promise<void> {
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { summary: null },
    });
  }
}