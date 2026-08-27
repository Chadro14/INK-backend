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
  // ✅ API 1 : STREAMING VIA CONSUMET (MULTIPLES FORMATS)
  // ============================================
  async getEpisodeStreamFromConsumet(animeId: string, episodeNumber: number): Promise<string> {
    // Différents formats d'URL possibles
    const urlPatterns = [
      `${this.CONSUMET_URL}/anime/gogoanime/watch/${animeId}-episode-${episodeNumber}`,
      `${this.CONSUMET_URL}/anime/gogoanime/watch/${animeId}-${episodeNumber}`,
      `${this.CONSUMET_URL}/anime/gogoanime/watch/${animeId}-episode-${String(episodeNumber).padStart(2, '0')}`,
      `${this.CONSUMET_URL}/anime/zoro/watch/${animeId}-episode-${episodeNumber}`,
      `${this.CONSUMET_URL}/anime/zoro/watch/${animeId}-${episodeNumber}`,
    ];

    for (const url of urlPatterns) {
      try {
        console.log(`📡 Tentative Consumet: ${url}`);
        const response = await axios.get(url, { timeout: 15000 });
        
        // Vérifier si la réponse contient des sources
        const sources = response.data?.sources || [];
        if (sources.length > 0) {
          const bestSource = sources.find((s: any) => s.quality === '1080p') || sources[0];
          console.log(`✅ Source trouvée: ${bestSource?.url?.substring(0, 60)}...`);
          return bestSource?.url || '';
        }
        
        // Vérifier si la réponse contient un lien direct
        if (response.data?.url) {
          console.log(`✅ Lien direct trouvé: ${response.data.url.substring(0, 60)}...`);
          return response.data.url;
        }
      } catch (error) {
        // Ignorer et continuer avec le prochain format
      }
    }

    console.log(`⚠️ Aucune source Consumet pour ${animeId}-ep-${episodeNumber}`);
    return '';
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
  // ✅ API 3 : YOUTUBE (FALLBACK ULTIME)
  // ============================================
  async searchYouTubeEpisode(animeTitle: string, episodeNumber: number): Promise<string> {
    try {
      const searchQuery = `${animeTitle} episode ${episodeNumber} english sub`;
      const url = `https://www.googleapis.com/youtube/v3/search`;
      
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ Clé YouTube API manquante');
        return '';
      }

      console.log(`📡 Recherche YouTube: "${searchQuery}"`);
      const response = await axios.get(url, {
        params: {
          part: 'snippet',
          q: searchQuery,
          type: 'video',
          maxResults: 3,
          key: apiKey,
          videoDuration: 'medium',
        },
        timeout: 10000,
      });

      const video = response.data?.items?.[0];
      if (video) {
        const videoId = video.id.videoId;
        console.log(`✅ Vidéo YouTube trouvée: https://youtu.be/${videoId}`);
        return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
      }
      return '';
    } catch (error) {
      console.warn('⚠️ YouTube search failed:', error.message);
      return '';
    }
  }

  // ============================================
  // ✅ MÉTHODE PRINCIPALE (AVEC YOUTUBE EN FALLBACK)
  // ============================================
  async getEpisodeVideo(
    animeId: string,
    episodeNumber: number,
    animeTitle?: string
  ): Promise<{
    url: string;
    source: 'consumet' | 'moviebox' | 'youtube' | 'none';
  }> {
    console.log(`🔍 Recherche vidéo pour ID: ${animeId}, épisode: ${episodeNumber}`);

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

    // 4. ✅ ESSAYER YOUTUBE (FALLBACK ULTIME)
    if (animeTitle) {
      console.log(`🔄 Tentative YouTube pour: "${animeTitle}"`);
      url = await this.searchYouTubeEpisode(animeTitle, episodeNumber);
      if (url) {
        return { url, source: 'youtube' };
      }
    }

    // 5. Aucune source
    console.log(`❌ Aucune source trouvée pour animeId: ${animeId}, épisode: ${episodeNumber}`);
    return { url: '', source: 'none' };
  }

  // ============================================
  // ✅ API 4 : FALLBACK ULTIME (GOOGLE SEARCH)
  // ============================================
  async getFallbackVideo(animeId: string, episodeNumber: number): Promise<string> {
    return `https://www.google.com/search?q=watch+${animeId}+episode+${episodeNumber}`;
  }
}
