// src/modules/ai/search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private aiRouter: AiRouterService,
  ) {}

  // ============================================
  // RECHERCHE INTELLIGENTE
  // ============================================
  async intelligentSearch(query: string, limit: number = 10): Promise<any[]> {
    // 1. Extraire les mots-clés avec l'IA
    const keywords = await this.extractKeywords(query);

    // 2. Rechercher dans la BDD
    const mangas = await this.prisma.manga.findMany({
      where: {
        OR: [
          { title: { contains: keywords, mode: 'insensitive' } },
          { description: { contains: keywords, mode: 'insensitive' } },
          { tags: { hasSome: keywords.split(' ') } },
          { aiTags: { hasSome: keywords.split(' ') } },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
          },
        },
        _count: {
          select: {
            chapters: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
      take: limit,
    });

    // 3. Si pas de résultats, faire une recherche plus large
    if (mangas.length === 0) {
      return this.fallbackSearch(query, limit);
    }

    return mangas;
  }

  // ============================================
  // EXTRAIRE LES MOTS-CLÉS AVEC L'IA
  // ============================================
  private async extractKeywords(query: string): Promise<string> {
    const prompt = `Extrais les mots-clés principaux de cette recherche de manga.

Recherche : "${query}"

Réponds UNIQUEMENT par les mots-clés séparés par des espaces. Aucune autre phrase.`;

    try {
      const result = await this.aiRouter.ask(prompt, undefined, {
        temperature: 0.3,
        maxTokens: 50,
      });

      return result.content.trim() || query;
    } catch (error) {
      this.logger.warn(
        `Extraction de mots-clés échouée, fallback sur la query brute : ${error.message}`,
      );
      return query;
    }
  }

  // ============================================
  // RECHERCHE DE FALLBACK
  // ============================================
  private async fallbackSearch(query: string, limit: number): Promise<any[]> {
    const words = query.split(' ').filter((w) => w.length > 2);

    if (words.length === 0) {
      return [];
    }

    return this.prisma.manga.findMany({
      where: {
        OR: words.map((word) => ({
          OR: [
            { title: { contains: word, mode: 'insensitive' } },
            { description: { contains: word, mode: 'insensitive' } },
          ],
        })),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
          },
        },
        _count: {
          select: {
            chapters: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
      take: limit,
    });
  }

  // ============================================
  // SUGGÉRER DES TAGS POUR LA RECHERCHE
  // ============================================
  async suggestSearchTags(query: string): Promise<string[]> {
    const prompt = `Propose 5 tags pertinents pour cette recherche de manga.

Recherche : "${query}"

Réponds UNIQUEMENT par 5 tags séparés par des virgules. Aucune autre phrase.`;

    try {
      const result = await this.aiRouter.ask(prompt, undefined, {
        temperature: 0.5,
        maxTokens: 100,
      });

      return result.content
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
    } catch (error) {
      this.logger.warn(`Suggestion de tags échouée : ${error.message}`);
      return [];
    }
  }
}
