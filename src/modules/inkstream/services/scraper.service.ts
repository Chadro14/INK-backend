import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScraperService {
  private readonly pinterestProxyUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.pinterestProxyUrl = this.configService.get('PINTEREST_PROXY_URL') || 
      'https://pinterest-search.apis-bj-devs.workers.dev';
  }

  // ============================================
  // 1. RECHERCHER DES ANIMES VIA PINTEREST
  // ============================================
  async searchAnimes(query: string, limit: number = 20): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.pinterestProxyUrl}/`, {
          params: {
            search: query,
            limit: limit,
          },
        }),
      );

      const pins = response.data?.result?.pins || [];

      // Transformer les pins en structure d'animes
      return pins.map((pin: any) => ({
        title: pin.description?.split(' ').slice(0, 5).join(' ') || 'Anime',
        description: pin.description || '',
        coverImage: pin.media?.images?.medium || pin.media?.images?.orig || '',
        externalUrl: pin.pin_url || '',
        externalId: pin.id || '',
        source: 'pinterest',
        rating: pin.like_count ? pin.like_count / 1000 : 0,
        uploader: pin.uploader?.username || '',
        uploaderName: pin.uploader?.full_name || '',
      }));
    } catch (error) {
      console.error('❌ Pinterest Scraper: Erreur', error.message);
      return [];
    }
  }

  // ============================================
  // 2. RECHERCHER DES ANIMES PAR MOTS-CLÉS
  // ============================================
  async searchByKeyword(keyword: string, limit: number = 20): Promise<any[]> {
    const queries = [
      `${keyword} anime`,
      `${keyword} manga`,
      `${keyword} art`,
      `${keyword} illustration`,
    ];

    const results = await Promise.all(
      queries.map(q => this.searchAnimes(q, Math.floor(limit / queries.length))),
    );

    // Fusionner et dédoublonner
    const allPins = results.flat();
    const uniquePins = allPins.filter(
      (pin, index, self) => index === self.findIndex((p) => p.externalId === pin.externalId),
    );

    return uniquePins.slice(0, limit);
  }

  // ============================================
  // 3. RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes(): Promise<any[]> {
    const keywords = ['anime', 'manga', 'naruto', 'attack on titan', 'demon slayer'];
    const results = await Promise.all(
      keywords.map(k => this.searchAnimes(k, 10)),
    );

    const allPins = results.flat();
    return allPins
      .filter(pin => pin.title)
      .slice(0, 20);
  }
}