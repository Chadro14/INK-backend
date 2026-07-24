import { Injectable } from '@nestjs/common';
import { ANILIST } from '@consumet/extensions';

@Injectable()
export class MovieboxService {
  private anilist: any;

  constructor() {
    this.anilist = new ANILIST();
  }

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  async searchAnimes(query: string, limit: number = 20) {
    try {
      const results = await this.anilist.search(query, {
        perPage: limit,
      });

      return results.results.map((item: any) => ({
        id: item.id,
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage || item.image || '',
        genre: item.genres || [],
        rating: item.rating || item.averageScore / 10 || 0,
        source: 'anilist',
        externalId: item.id,
        episodesCount: item.episodes || item.totalEpisodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Consumet search error:', error.message);
      return [];
    }
  }

  // ============================================
  // RÉCUPÉRER LES DÉTAILS D'UN ANIME
  // ============================================
  async getAnimeDetails(id: string) {
    try {
      const details = await this.anilist.getAnime(id);

      return {
        id: details.id,
        title: details.title?.english || details.title?.romaji || details.title?.native || 'Sans titre',
        description: details.description || '',
        coverImage: details.coverImage || '',
        bannerImage: details.bannerImage || '',
        genre: details.genres || [],
        rating: details.averageScore / 10 || 0,
        source: 'anilist',
        externalId: details.id,
        episodesCount: details.episodes || 0,
        status: details.status || 'UNKNOWN',
        episodes: details.episodes?.map((ep: any) => ({
          id: ep.id,
          episodeNumber: ep.episodeNumber || ep.number,
          title: ep.title || `Épisode ${ep.episodeNumber}`,
          duration: ep.duration || 0,
        })) || [],
      };
    } catch (error) {
      console.error('❌ Consumet details error:', error.message);
      throw new Error('Impossible de récupérer les détails de l\'anime');
    }
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes(limit: number = 10) {
    try {
      const results = await this.anilist.getPopularAnimes({
        perPage: limit,
      });

      return results.results.map((item: any) => ({
        id: item.id,
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage || item.image || '',
        genre: item.genres || [],
        rating: item.rating || item.averageScore / 10 || 0,
        source: 'anilist',
        externalId: item.id,
        episodesCount: item.episodes || item.totalEpisodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Consumet popular error:', error.message);
      return [];
    }
  }

  // ============================================
  // RÉCUPÉRER L'URL DE STREAMING (si disponible)
  // ============================================
  async getEpisodeStreamUrl(episodeId: string) {
    return {
      videoUrl: '',
      subtitles: [],
      sources: [],
    };
  }
}