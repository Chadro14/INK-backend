// src/modules/ai/search.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
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

Mots-clés (séparés par des espaces) :`;

    const reply = await this.callGroq(prompt);
    return reply.trim() || query;
  }

  // ============================================
  // RECHERCHE DE FALLBACK
  // ============================================
  private async fallbackSearch(query: string, limit: number): Promise<any[]> {
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
  // SUGGÉRER DES TAGS POUR LA RECHERCHE
  // ============================================
  async suggestSearchTags(query: string): Promise<string[]> {
    const prompt = `Propose 5 tags pertinents pour cette recherche de manga.

Recherche : "${query}"

Tags suggérés (séparés par des virgules) :`;

    const reply = await this.callGroq(prompt);

    return reply
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
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
            temperature: 0.3,
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