// src/modules/ai/tag.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TagService {
  private readonly groqKeys: string[] = [
    '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',
    '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',
    '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',
    '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',
  ];

  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private prisma: PrismaService) {}

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

    const reply = await this.callGroq(prompt);

    const tags = reply
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length < 30)
      .slice(0, 5);

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

  // ============================================
  // APPEL GROQ
  // ============================================
  private async callGroq(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return reply;
        }
      } catch (error) {
        continue;
      }
    }

    return '';
  }
}