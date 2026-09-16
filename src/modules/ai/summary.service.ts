// src/modules/ai/summary.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private prisma: PrismaService,
    private aiRouter: AiRouterService,
  ) {}

  // ============================================
  // GÉNÉRER UN RÉSUMÉ
  // ============================================
  async generateSummary(content: string, title: string): Promise<string> {
    const prompt = `Génère un résumé court et accrocheur pour ce chapitre.

Titre du chapitre : ${title || 'Sans titre'}
Contenu : ${content.slice(0, 2000)}${content.length > 2000 ? '...' : ''}

Résumé (3-4 phrases) :`;

    try {
      const result = await this.aiRouter.ask(
        prompt,
        "Tu es OZYRA, l'assistante d'INKDROP. Tu génères des résumés courts et accrocheurs de chapitres de mangas.",
        { temperature: 0.5, maxTokens: 300 },
      );

      return result.content || 'Aucun résumé disponible.';
    } catch (error) {
      this.logger.error(`Erreur génération résumé : ${error.message}`);
      return 'Aucun résumé disponible.';
    }
  }

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
