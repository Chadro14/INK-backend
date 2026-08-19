// src/modules/ai/coach.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoachService {
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
  // ANALYSE D'UN MANGA
  // ============================================
  async analyzeManga(mangaId: string): Promise<any> {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      include: {
        author: true,
        _count: {
          select: {
            chapters: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!manga) {
      throw new Error('Manga non trouvé');
    }

    const prompt = `Analyse ce manga et donne des conseils d'amélioration.

Titre : ${manga.title}
Description : ${manga.description || 'Aucune description'}
Genres : ${manga.genre.join(', ')}
Tags : ${manga.tags.join(', ')}
Nombre de chapitres : ${manga._count.chapters}
Nombre de likes : ${manga._count.likes}
Nombre d'abonnés : ${manga._count.subscriptions}

Donne 3 conseils concrets pour améliorer ce manga :
1. Amélioration du titre/description
2. Stratégie de publication
3. Engagement des lecteurs

Conseils :`;

    const reply = await this.callGroq(prompt);

    return {
      mangaId: manga.id,
      title: manga.title,
      advice: reply,
    };
  }

  // ============================================
  // SUGGESTIONS D'AMÉLIORATION
  // ============================================
  async suggestImprovements(
    title: string,
    description: string,
    genres: string[],
  ): Promise<string> {
    const prompt = `Tu es un coach de création pour INKDROP.

Titre du manga : ${title}
Description actuelle : ${description || 'Aucune description'}
Genres : ${genres.join(', ') || 'Aucun'}

Propose 3 améliorations pour rendre ce manga plus attractif :
1. Suggestion de nouveau titre (si nécessaire)
2. Amélioration de la description
3. Suggestions de tags supplémentaires

Améliorations :`;

    return this.callGroq(prompt);
  }

  // ============================================
  // CONSEILS DE CROISSANCE
  // ============================================
  async growthAdvice(mangaId: string): Promise<string> {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      include: {
        _count: {
          select: {
            chapters: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!manga) {
      throw new Error('Manga non trouvé');
    }

    const prompt = `Tu es un coach de croissance pour INKDROP.

Statistiques du manga :
- Titre : ${manga.title}
- Chapitres : ${manga._count.chapters}
- Likes : ${manga._count.likes}
- Abonnés : ${manga._count.subscriptions}
- Genres : ${manga.genre.join(', ')}

Donne 3 conseils pour augmenter la visibilité et l'engagement de ce manga :
1. Stratégie de publication
2. Engagement communautaire
3. Promotion sur INKDROP

Conseils :`;

    return this.callGroq(prompt);
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
            max_tokens: 500,
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

    return 'Je n\'ai pas pu générer de conseils. Veuillez réessayer.';
  }
}