import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MovieboxService {
  private readonly ANILIST_URL = 'https://graphql.anilist.co';

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  async searchAnimes(query: string, limit: number = 20) {
    const gqlQuery = `
      query ($search: String, $perPage: Int) {
        Page(perPage: $perPage) {
          media(search: $search, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
            }
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
  // RÉCUPÉRER LES DÉTAILS D'UN ANIME
  // ============================================
  async getAnimeDetails(id: string) {
    const gqlQuery = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          bannerImage
          description
          episodes
          genres
          averageScore
          status
          nextAiringEpisode {
            episode
            timeUntilAiring
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.ANILIST_URL, {
        query: gqlQuery,
        variables: { id: parseInt(id) },
      });

      const item = response.data?.data?.Media;
      if (!item) {
        throw new Error('Anime non trouvé');
      }

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
      throw new Error('Impossible de récupérer les détails de l\'anime');
    }
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes(limit: number = 10) {
    const gqlQuery = `
      query ($perPage: Int) {
        Page(perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
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
  // RÉCUPÉRER LES ANIMES À L'AFFICHE (TRENDING)
  // ============================================
  async getTrendingAnimes(limit: number = 10) {
    const gqlQuery = `
      query ($perPage: Int) {
        Page(perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
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
  // RÉCUPÉRER LES ANIMES PAR GENRE
  // ============================================
  async getAnimesByGenre(genre: string, limit: number = 20) {
    const gqlQuery = `
      query ($genre: String, $perPage: Int) {
        Page(perPage: $perPage) {
          media(genre: $genre, type: ANIME) {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
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
}