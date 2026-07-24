import { Injectable } from '@nestjs/common';
import { MovieboxSession, search, getMovieDetails, getMovieStreamUrl } from 'moviebox-js-sdk';

@Injectable()
export class MovieboxService {
  private session: any;

  constructor() {
    // Initialiser la session MovieBox
    this.session = new MovieboxSession();
  }

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  async searchAnimes(query: string, limit: number = 20) {
    try {
      const results = await search(query, {
        limit,
        type: 'movie', // ou 'tv' pour les séries
        session: this.session,
      });

      return results.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.overview || item.description || '',
        coverImage: item.poster_path || item.coverImage || '',
        genre: item.genres || [],
        rating: item.vote_average || item.rating || 0,
        source: 'moviebox',
        externalId: item.id,
        externalUrl: item.url || '',
        episodesCount: item.episode_count || 0,
      }));
    } catch (error) {
      console.error('❌ MovieBox search error:', error.message);
      return [];
    }
  }

  // ============================================
  // RÉCUPÉRER LES DÉTAILS D'UN ANIME
  // ============================================
  async getAnimeDetails(id: string) {
    try {
      const details = await getMovieDetails(id, {
        session: this.session,
      });

      return {
        id: details.id,
        title: details.title,
        description: details.overview || details.description || '',
        coverImage: details.poster_path || details.coverImage || '',
        genre: details.genres || [],
        rating: details.vote_average || details.rating || 0,
        source: 'moviebox',
        externalId: details.id,
        externalUrl: details.url || '',
        episodesCount: details.episode_count || 0,
        episodes: details.episodes?.map((ep: any) => ({
          id: ep.id,
          episodeNumber: ep.episode_number || ep.number,
          title: ep.title || `Épisode ${ep.episode_number}`,
          duration: ep.duration || 0,
        })) || [],
      };
    } catch (error) {
      console.error('❌ MovieBox details error:', error.message);
      throw new Error('Impossible de récupérer les détails de l\'anime');
    }
  }

  // ============================================
  // RÉCUPÉRER L'URL DE STREAMING D'UN ÉPISODE
  // ============================================
  async getEpisodeStreamUrl(episodeId: string) {
    try {
      const streamData = await getMovieStreamUrl(episodeId, {
        session: this.session,
      });

      return {
        videoUrl: streamData.url || streamData.videoUrl || '',
        subtitles: streamData.subtitles || [],
        sources: streamData.sources || [],
      };
    } catch (error) {
      console.error('❌ MovieBox stream error:', error.message);
      throw new Error('Impossible de récupérer le lien de streaming');
    }
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes(limit: number = 10) {
    // Simuler des animes populaires via recherche
    const popularQueries = ['naruto', 'demon slayer', 'one piece', 'jujutsu', 'attack on titan'];
    const results = await Promise.all(
      popularQueries.slice(0, 3).map((q) => this.searchAnimes(q, 5))
    );

    const allAnimes = results.flat();
    const uniqueAnimes = allAnimes.filter(
      (anime, index, self) => index === self.findIndex((a) => a.id === anime.id)
    );

    return uniqueAnimes.slice(0, limit);
  }
}