import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoachService {
  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  // ============================================
  // ANALYSE D'UN MANGA
  // ============================================
  async analyzeManga(userId: string, mangaId: string): Promise<any> {
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

    const result = await this.aiService.chat(userId, prompt, [], 'Système');

    return {
      mangaId: manga.id,
      title: manga.title,
      advice: result.reply,
    };
  }

  // ============================================
  // SUGGESTIONS D'AMÉLIORATION
  // ============================================
  async suggestImprovements(
    userId: string,
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

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }

  // ============================================
  // CONSEILS DE CROISSANCE
  // ============================================
  async growthAdvice(userId: string, mangaId: string): Promise<string> {
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

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }
}