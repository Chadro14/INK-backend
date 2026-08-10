import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  // ============================================
  // RECHERCHE INTELLIGENTE
  // ============================================
  async intelligentSearch(
    userId: string,
    query: string,
    limit: number = 10,
  ): Promise<any[]> {
    // 1. Extraire les mots-clés avec l'IA
    const keywords = await this.extractKeywords(userId, query);

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
      return this.fallbackSearch(userId, query, limit);
    }

    // 4. Ajouter un score de pertinence
    return mangas.map(manga => ({
      ...manga,
      relevanceScore: this.calculateRelevance(manga, query, keywords),
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ============================================
  // EXTRAIRE LES MOTS-CLÉS AVEC L'IA
  // ============================================
  private async extractKeywords(userId: string, query: string): Promise<string> {
    const prompt = `Extrais les mots-clés principaux de cette recherche de manga.

Recherche : "${query}"

Mots-clés (séparés par des espaces) :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply.trim() || query;
  }

  // ============================================
  // RECHERCHE DE FALLBACK
  // ============================================
  private async fallbackSearch(
    userId: string,
    query: string,
    limit: number,
  ): Promise<any[]> {
    // Recherche par mots simples
    const words = query.split(' ').filter(w => w.length > 2);

    if (words.length === 0) {
      return [];
    }

    return this.prisma.manga.findMany({
      where: {
        OR: words.map(word => ({
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
  // CALCULER LE SCORE DE PERTINENCE
  // ============================================
  private calculateRelevance(manga: any, query: string, keywords: string): number {
    let score = 0;

    // Titre correspondant
    if (manga.title.toLowerCase().includes(query.toLowerCase())) {
      score += 10;
    }

    // Mots-clés dans le titre
    keywords.split(' ').forEach(keyword => {
      if (manga.title.toLowerCase().includes(keyword.toLowerCase())) {
        score += 3;
      }
    });

    // Mots-clés dans les tags
    const allTags = [...(manga.tags || []), ...(manga.aiTags || [])];
    keywords.split(' ').forEach(keyword => {
      if (allTags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))) {
        score += 2;
      }
    });

    // Popularité
    score += (manga._count?.likes || 0) * 0.1;
    score += (manga._count?.subscriptions || 0) * 0.2;

    return Math.round(score * 10) / 10;
  }

  // ============================================
  // SUGGÉRER DES TAGS POUR LA RECHERCHE
  // ============================================
  async suggestSearchTags(userId: string, query: string): Promise<string[]> {
    const prompt = `Propose 5 tags pertinents pour cette recherche de manga.

Recherche : "${query}"

Tags suggérés (séparés par des virgules) :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');

    return result.reply
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  }
}