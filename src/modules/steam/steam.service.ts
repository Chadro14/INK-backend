import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class InkstreamService {
  private readonly movieboxApiUrl = 'https://api.moviebox.com/v1'; // URL réelle à remplacer

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes(limit: number = 10) {
    try {
      // Exemple d'appel vers MovieBox
      const response = await axios.get(`${this.movieboxApiUrl}/popular`, {
        params: { limit },
      });

      return response.data.results.map(this.formatAnime);
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la récupération des animes populaires',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  async searchAnimes(query: string, limit: number = 10) {
    try {
      const response = await axios.get(`${this.movieboxApiUrl}/search`, {
        params: { q: query, limit },
      });

      return response.data.results.map(this.formatAnime);
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LES DÉTAILS D'UN ANIME
  // ============================================
  async getAnimeDetails(animeId: string) {
    try {
      const response = await axios.get(`${this.movieboxApiUrl}/details/${animeId}`);
      return this.formatAnimeDetails(response.data);
    } catch (error) {
      throw new HttpException(
        'Anime non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LE LIEN DE STREAMING
  // ============================================
  async getStreamUrl(animeId: string, episode: number) {
    try {
      const response = await axios.get(`${this.movieboxApiUrl}/stream/${animeId}`, {
        params: { episode },
      });

      return {
        streamUrl: response.data.streamUrl,
        subtitles: response.data.subtitles || [],
        quality: response.data.quality || 'auto',
      };
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la récupération du flux vidéo',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // FORMATAGE DES DONNÉES
  // ============================================
  private formatAnime(data: any) {
    return {
      id: data.id,
      title: data.title,
      titleFrench: data.title_french || data.title,
      coverImage: data.cover_url || data.poster || data.image,
      bannerImage: data.banner_url || null,
      rating: data.rating || 0,
      year: data.year || null,
      genre: data.genres || [],
      description: data.description || data.overview || '',
      episodes: data.episodes || 0,
    };
  }

  private formatAnimeDetails(data: any) {
    return {
      ...this.formatAnime(data),
      synopsis: data.synopsis || data.description || '',
      status: data.status || 'En cours',
      studios: data.studios || [],
      characters: data.characters || [],
      episodes: data.episodes?.map((ep: any) => ({
        number: ep.number,
        title: ep.title,
        thumbnail: ep.thumbnail || null,
        duration: ep.duration || null,
      })) || [],
      recommendations: data.recommendations?.map(this.formatAnime) || [],
    };
  }
}