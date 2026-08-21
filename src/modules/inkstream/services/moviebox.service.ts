// src/modules/inkstream/services/moviebox.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MovieboxService {
  private readonly ANILIST_URL = 'https://graphql.anilist.co';
  private readonly CONSUMET_URL = 'https://api.consumet.org';

  // ============================================
  // RECHERCHE ANILIST
  // ============================================
  async searchAnimes(query: string, limit: number = 20) {
    const gqlQuery = `
      query ($search: String, $perPage: Int) {
        Page(perPage: $perPage) {
          media(search: $search, type: ANIME) {
            id
            title { romaji english native }
            coverImage { large }
            description
            episodes
            genres
            averageScore
            status
            bannerImage
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { search: query, perPage: limit },
      });

      const media = response.data?.data?.Page?.media || [];
      
      return media.map((item: any) => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage?.large || '',
        bannerImage: item.bannerImage || '',
        genre: item.genres || [],
        rating: item.averageScore ? item.averageScore / 10 : 0,
        source: 'anilist',
        externalId: String(item.id),
        episodesCount: item.episodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Anilist search error:', error.message);
      return [];
    }
  }

  // ============================================
  // DÉTAILS ANILIST
  // ============================================
  async getAnimeDetails(id: string) {
    const gqlQuery = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large }
          bannerImage
          description
          episodes
          genres
          averageScore
          status
          nextAiringEpisode { episode timeUntilAiring }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { id: parseInt(id) },
      });

      const item = response.data?.data?.Media;
      if (!item) return null;

      return {
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage?.large || '',
        bannerImage: item.bannerImage || '',
        genre: item.genres || [],
        rating: item.averageScore ? item.averageScore / 10 : 0,
        source: 'anilist',
        externalId: String(item.id),
        episodesCount: item.episodes || 0,
        status: item.status || 'UNKNOWN',
        nextEpisode: item.nextAiringEpisode ? {
          episode: item.nextAiringEpisode.episode,
          timeUntilAiring: item.nextAiringEpisode.timeUntilAiring,
        } : null,
      };
    } catch (error) {
      console.error('❌ Anilist details error:', error.message);
      return null;
    }
  }

  // ============================================
  // ANIMES POPULAIRES ANILIST
  // ============================================
  async getPopularAnimes(limit: number = 10) {
    const gqlQuery = `
      query ($perPage: Int) {
        Page(perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large }
            description
            episodes
            genres
            averageScore
            status
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { perPage: limit },
      });

      const media = response.data?.data?.Page?.media || [];
      
      return media.map((item: any) => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage?.large || '',
        genre: item.genres || [],
        rating: item.averageScore ? item.averageScore / 10 : 0,
        source: 'anilist',
        externalId: String(item.id),
        episodesCount: item.episodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Anilist popular error:', error.message);
      return [];
    }
  }

  // ============================================
  // ANIMES TENDANCES ANILIST
  // ============================================
  async getTrendingAnimes(limit: number = 10) {
    const gqlQuery = `
      query ($perPage: Int) {
        Page(perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            title { romaji english }
            coverImage { large }
            description
            episodes
            genres
            averageScore
            status
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { perPage: limit },
      });

      const media = response.data?.data?.Page?.media || [];
      
      return media.map((item: any) => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage?.large || '',
        genre: item.genres || [],
        rating: item.averageScore ? item.averageScore / 10 : 0,
        source: 'anilist',
        externalId: String(item.id),
        episodesCount: item.episodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Anilist trending error:', error.message);
      return [];
    }
  }

  // ============================================
  // ANIMES PAR GENRE
  // ============================================
  async getAnimesByGenre(genre: string, limit: number = 20) {
    const gqlQuery = `
      query ($genre: String, $perPage: Int) {
        Page(perPage: $perPage) {
          media(genre: $genre, type: ANIME) {
            id
            title { romaji english }
            coverImage { large }
            description
            episodes
            genres
            averageScore
            status
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { genre, perPage: limit },
      });

      const media = response.data?.data?.Page?.media || [];
      
      return media.map((item: any) => ({
        id: String(item.id),
        title: item.title?.english || item.title?.romaji || 'Sans titre',
        description: item.description || '',
        coverImage: item.coverImage?.large || '',
        genre: item.genres || [],
        rating: item.averageScore ? item.averageScore / 10 : 0,
        source: 'anilist',
        externalId: String(item.id),
        episodesCount: item.episodes || 0,
        status: item.status || 'UNKNOWN',
      }));
    } catch (error) {
      console.error('❌ Anilist genre error:', error.message);
      return [];
    }
  }

  // ============================================
  // ✅ API 1 : STREAMING VIA CONSUMET
  // ============================================
  async getEpisodeStreamFromConsumet(animeId: string, episodeNumber: number): Promise<string> {
    try {
      // Essayer avec Gogoanime
      const response = await axios.get(
        `${this.CONSUMET_URL}/anime/gogoanime/watch/${animeId}-episode-${episodeNumber}`
      );

      const sources = response.data?.sources || [];
      if (sources.length > 0) {
        // Prendre la meilleure qualité (la première ou la plus haute)
        const bestSource = sources.find((s: any) => s.quality === '1080p') || sources[0];
        return bestSource?.url || '';
      }

      // Essayer avec Zoro (fallback)
      const zoroResponse = await axios.get(
        `${this.CONSUMET_URL}/anime/zoro/watch/${animeId}-${episodeNumber}`
      );
      const zoroSources = zoroResponse.data?.sources || [];
      if (zoroSources.length > 0) {
        const bestZoro = zoroSources.find((s: any) => s.quality === '1080p') || zoroSources[0];
        return bestZoro?.url || '';
      }

      return '';
    } catch (error) {
      console.warn('⚠️ Consumet stream failed:', error.message);
      return '';
    }
  }

  // ============================================
  // ✅ API 2 : STREAMING VIA MOVIEBOX (FALLBACK)
  // ============================================
  async getEpisodeStreamFromMovieBox(animeId: string, episodeNumber: number): Promise<string> {
    try {
      // URL à adapter selon l'API MovieBox réelle
      const response = await axios.get(
        `https://api.moviebox.com/anime/${animeId}/episode/${episodeNumber}/stream`
      );
      return response.data?.url || '';
    } catch (error) {
      console.warn('⚠️ MovieBox stream failed:', error.message);
      return '';
    }
  }

  // ============================================
  // ✅ API 3 : RECUPERER UNE VIDÉO DE FALLBACK
  // ============================================
  async getFallbackVideo(animeId: string, episodeNumber: number): Promise<string> {
    // Cette méthode peut être utilisée si les autres API échouent
    // Exemple : utiliser un lien YouTube ou Dailymotion
    // Ou rediriger vers une page externe
    return '';
  }
}
