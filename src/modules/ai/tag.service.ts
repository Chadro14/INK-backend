import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TagService {
  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  // ============================================
  // GÉNÉRER DES TAGS POUR UN MANGA
  // ============================================
  async generateTags(
    userId: string,
    mangaId: string,
    title: string,
    description: string,
    genres: string[],
  ): Promise<string[]> {
    // 1. Construire le prompt
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

    // 2. Appeler l'IA
    const result = await this.aiService.chat(
      userId,
      prompt,
      [],
      'Système',
    );

    if (!result.success) {
      return [];
    }

    // 3. Extraire les tags
    const tags = result.reply
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length < 30)
      .slice(0, 5);

    // 4. Sauvegarder dans la BDD
    if (tags.length > 0) {
      await this.prisma.manga.update({
        where: { id: mangaId },
        data: { aiTags: tags },
      });
    }

    return tags;
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
}