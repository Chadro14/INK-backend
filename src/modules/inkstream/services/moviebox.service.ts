// src/modules/inkstream/services/moviebox.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MovieboxService {
  private readonly ANILIST_URL = 'https://graphql.anilist.co';
  private readonly CONSUMET_URL = 'https://consumet-api.onrender.com';

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
  // ✅ RÉCUPÉRER L'ID GOGOANIME DEPUIS ANILIST
  // ============================================
  async getGogoanimeIdFromAnilist(anilistId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.CONSUMET_URL}/meta/anilist/info/${anilistId}`,
        { timeout: 10000 }
      );
      
      const gogoId = response.data?.id;
      if (gogoId) {
        console.log(`✅ ID Gogoanime trouvé: ${gogoId} pour AniList ID ${anilistId}`);
        return gogoId;
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Erreur récupération ID Gogoanime pour ${anilistId}:`, error.message);
      return null;
    }
  }

  // ============================================
  // ✅ API 1 : STREAMING VIA CONSUMET
  // ============================================
  async getEpisodeStreamFromConsumet(animeId: string, episodeNumber: number): Promise<string> {
    try {
      // Essayer avec Gogoanime
      const url = `${this.CONSUMET_URL}/anime/gogoanime/watch/${animeId}-episode-${episodeNumber}`;
      console.log(`📡 Appel Consumet: ${url}`);
      
      const response = await axios.get(url, { timeout: 15000 });
      const sources = response.data?.sources || [];
      
      if (sources.length > 0) {
        const bestSource = sources.find((s: any) => s.quality === '1080p') || sources[0];
        console.log(`✅ Source Consumet trouvée: ${bestSource?.url?.substring(0, 50)}...`);
        return bestSource?.url || '';
      }

      // Essayer avec Zoro (fallback)
      const zoroResponse = await axios.get(
        `${this.CONSUMET_URL}/anime/zoro/watch/${animeId}-${episodeNumber}`,
        { timeout: 15000 }
      );
      const zoroSources = zoroResponse.data?.sources || [];
      if (zoroSources.length > 0) {
        const bestZoro = zoroSources.find((s: any) => s.quality === '1080p') || zoroSources[0];
        console.log(`✅ Source Zoro trouvée: ${bestZoro?.url?.substring(0, 50)}...`);
        return bestZoro?.url || '';
      }

      console.log(`⚠️ Aucune source Consumet pour ${animeId}-ep-${episodeNumber}`);
      return '';
    } catch (error) {
      console.warn(`⚠️ Consumet stream failed pour ${animeId}:`, error.message);
      return '';
    }
  }

  // ============================================
  // ✅ API 2 : STREAMING VIA MOVIEBOX (FALLBACK)
  // ============================================
  async getEpisodeStreamFromMovieBox(animeId: string, episodeNumber: number): Promise<string> {
    try {
      const response = await axios.get(
        `https://api.moviebox.com/anime/${animeId}/episode/${episodeNumber}/stream`,
        { timeout: 10000 }
      );
      return response.data?.url || '';
    } catch (error) {
      console.warn('⚠️ MovieBox stream failed:', error.message);
      return '';
    }
  }

  // ============================================
  // ✅ MÉTHODE PRINCIPALE POUR OBTENIR UNE VIDÉO (AVEC FALLBACK GOGOANIME)
  // ============================================
  async getEpisodeVideo(animeId: string, episodeNumber: number): Promise<{
    url: string;
    source: 'consumet' | 'moviebox' | 'none';
  }> {
    console.log(`🔍 Recherche vidéo pour animeId: ${animeId}, épisode: ${episodeNumber}`);

    // 1. Essayer Consumet directement avec l'ID fourni
    let url = await this.getEpisodeStreamFromConsumet(animeId, episodeNumber);
    if (url) {
      return { url, source: 'consumet' };
    }

    // 2. Essayer de trouver l'ID Gogoanime via AniList
    const isNumeric = /^\d+$/.test(animeId);
    if (isNumeric) {
      console.log(`🔄 Tentative de récupération de l'ID Gogoanime pour l'ID AniList: ${animeId}`);
      const gogoId = await this.getGogoanimeIdFromAnilist(animeId);
      if (gogoId && gogoId !== animeId) {
        console.log(`🔄 Réessai avec l'ID Gogoanime: ${gogoId}`);
        url = await this.getEpisodeStreamFromConsumet(gogoId, episodeNumber);
        if (url) {
          return { url, source: 'consumet' };
        }
      }
    }

    // 3. Essayer MovieBox
    url = await this.getEpisodeStreamFromMovieBox(animeId, episodeNumber);
    if (url) {
      return { url, source: 'moviebox' };
    }

    // 4. Aucune source
    console.log(`❌ Aucune source trouvée pour animeId: ${animeId}, épisode: ${episodeNumber}`);
    return { url: '', source: 'none' };
  }

  // ============================================
  // ✅ API 3 : FALLBACK ULTIME
  // ============================================
  async getFallbackVideo(animeId: string, episodeNumber: number): Promise<string> {
    return `https://www.google.com/search?q=watch+${animeId}+episode+${episodeNumber}`;
  }
}
