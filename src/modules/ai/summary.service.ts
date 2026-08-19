// src/modules/ai/summary.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SummaryService {
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
  // GÉNÉRER UN RÉSUMÉ
  // ============================================
  async generateSummary(content: string, title: string): Promise<string> {
    const prompt = `Génère un résumé court et accrocheur pour ce chapitre.

Titre du chapitre : ${title || 'Sans titre'}
Contenu : ${content.slice(0, 2000)}${content.length > 2000 ? '...' : ''}

Résumé (3-4 phrases) :`;

    const reply = await this.callGroq(prompt);
    return reply || 'Aucun résumé disponible.';
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
            temperature: 0.5,
            max_tokens: 300,
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