// src/modules/ai/coach.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private prisma: PrismaService,
    private aiRouter: AiRouterService,
  ) {}

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
      throw new NotFoundException('Manga non trouvé');
    }

    const systemInstruction = `Tu es OZYRA, coach de création pour INKDROP. Tu analyses des mangas et donnes des conseils concrets et actionnables.`;

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

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.7,
        maxTokens: 600,
      });

      return {
        mangaId: manga.id,
        title: manga.title,
        advice: result.content,
      };
    } catch (error) {
      this.logger.error(
        `Erreur analyse manga ${mangaId} : ${error.message}`,
      );
      return {
        mangaId: manga.id,
        title: manga.title,
        advice:
          "Je n'ai pas pu analyser ce manga pour le moment. Réessaie dans quelques minutes.",
      };
    }
  }

  // ============================================
  // SUGGESTIONS D'AMÉLIORATION
  // ============================================
  async suggestImprovements(
    title: string,
    description: string,
    genres: string[],
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, coach de création pour INKDROP. Tu aides les créateurs à rendre leurs mangas plus attractifs.`;

    const prompt = `Titre du manga : ${title}
Description actuelle : ${description || 'Aucune description'}
Genres : ${genres.join(', ') || 'Aucun'}

Propose 3 améliorations pour rendre ce manga plus attractif :
1. Suggestion de nouveau titre (si nécessaire)
2. Amélioration de la description
3. Suggestions de tags supplémentaires

Améliorations :`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.7,
        maxTokens: 600,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(`Suggestion d'amélioration échouée : ${error.message}`);
      return "Je n'ai pas pu générer de conseils. Veuillez réessayer.";
    }
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
      throw new NotFoundException('Manga non trouvé');
    }

    const systemInstruction = `Tu es OZYRA, coach de croissance pour INKDROP. Tu aides les créateurs à augmenter la visibilité et l'engagement de leurs mangas.`;

    const prompt = `Statistiques du manga :
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

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.7,
        maxTokens: 600,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(
        `Conseils de croissance échoués pour ${mangaId} : ${error.message}`,
      );
      return "Je n'ai pas pu générer de conseils. Veuillez réessayer.";
    }
  }
}
