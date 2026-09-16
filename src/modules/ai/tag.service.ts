// src/modules/ai/tag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);

  constructor(
    private prisma: PrismaService,
    private aiRouter: AiRouterService,
  ) {}

  // ============================================
  // GÉNÉRER DES TAGS POUR UN MANGA
  // ============================================
  async generateTags(
    title: string,
    description: string,
    genres: string[],
  ): Promise<string[]> {
    const prompt = `Propose 5 tags pertinents pour ce manga.

Titre : ${title}
Description : ${description || 'Aucune description'}
Genres actuels : ${genres.join(', ') || 'Aucun'}

Les tags doivent être :
- Courts (1-2 mots)
- Pertinents pour le manga
- En français
- Séparés par des virgules

Tags proposés :`;

    try {
      const result = await this.aiRouter.ask(prompt);
      const reply = result.content;

      const tags = reply
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length < 30)
        .slice(0, 5);

      return tags;
    } catch (error) {
      this.logger.error(`Erreur génération tags : ${error.message}`);
      return [];
    }
  }

  // ============================================
  // RÉCUPÉRER LES TAGS D'UN MANGA
  // ============================================
  async getTags(mangaId: string): Promise<string[]> {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { aiTags: true },
    });

    return manga?.aiTags || [];
  }

  // ============================================
  // SAUVEGARDER LES TAGS D'UN MANGA
  // ============================================
  async saveTags(mangaId: string, tags: string[]): Promise<void> {
    await this.prisma.manga.update({
      where: { id: mangaId },
      data: { aiTags: tags },
    });
  }

  // ============================================
  // SUPPRIMER LES TAGS D'UN MANGA
  // ============================================
  async deleteTags(mangaId: string): Promise<void> {
    await this.prisma.manga.update({
      where: { id: mangaId },
      data: { aiTags: [] },
    });
  }
}
