import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createClient, MangaProvider } from 'nyora-sdk';

@Injectable()
export class MangaApiService {
  private client: any;

  constructor() {
    // ✅ Initialiser le client avec la source MangaDex
    this.client = createClient({
      provider: MangaProvider.MANGADEX,
    });
  }

  // ============================================
  // RÉCUPÉRER LES MANGAS POPULAIRES
  // ============================================
  async getPopularManga(limit: number = 20) {
    try {
      const result = await this.client.manga.fetchPopular({
        limit: limit,
        language: 'fr', // ✅ FORCER LE FRANÇAIS
      });

      return result.data.map((manga: any) => ({
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.cover || manga.image || null,
        author: manga.author ? {
          id: manga.author.id,
          name: manga.author.name || 'Inconnu',
        } : null,
        rating: manga.rating || null,
        status: manga.status || 'unknown',
        year: manga.year || null,
        genres: manga.genres || [],
      }));
    } catch (error) {
      console.error('Erreur nyora-sdk:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des mangas populaires',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RECHERCHER DES MANGAS
  // ============================================
  async searchManga(query: string, limit: number = 20) {
    try {
      const result = await this.client.manga.search(query, {
        limit: limit,
        language: 'fr', // ✅ FORCER LE FRANÇAIS
      });

      return result.data.map((manga: any) => ({
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.cover || manga.image || null,
        author: manga.author ? {
          id: manga.author.id,
          name: manga.author.name || 'Inconnu',
        } : null,
        rating: manga.rating || null,
        status: manga.status || 'unknown',
        year: manga.year || null,
        genres: manga.genres || [],
      }));
    } catch (error) {
      console.error('Erreur recherche nyora-sdk:', error.message);
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LES DÉTAILS D'UN MANGA
  // ============================================
  async getMangaDetails(mangaId: string) {
    try {
      const manga = await this.client.manga.fetchInfo(mangaId, {
        language: 'fr', // ✅ FORCER LE FRANÇAIS
      });

      return {
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.cover || manga.image || null,
        author: manga.author ? {
          id: manga.author.id,
          name: manga.author.name || 'Inconnu',
        } : null,
        rating: manga.rating || null,
        status: manga.status || 'unknown',
        year: manga.year || null,
        genres: manga.genres || [],
        chapters: manga.chapters || 0,
        createdAt: manga.createdAt || null,
      };
    } catch (error) {
      console.error('Erreur détails nyora-sdk:', error.message);
      throw new HttpException(
        'Manga non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA
  // ============================================
  async getMangaChapters(mangaId: string, limit: number = 100) {
    try {
      const chapters = await this.client.manga.fetchChapters(mangaId, {
        limit: limit,
        language: 'fr', // ✅ FORCER LE FRANÇAIS
      });

      return chapters.map((chapter: any) => ({
        id: chapter.id,
        chapter: chapter.number || '0',
        title: chapter.title || `Chapitre ${chapter.number || '0'}`,
        pages: chapter.pages || 0,
        publishedAt: chapter.publishedAt || new Date(),
      }));
    } catch (error) {
      console.error('Erreur chapitres nyora-sdk:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des chapitres',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LES PAGES D'UN CHAPITRE
  // ============================================
  async getChapterPages(chapterId: string) {
    try {
      const pages = await this.client.manga.fetchPages(chapterId);

      return {
        pages: pages.map((page: any) => ({
          url: page.url || page.image || page.img,
        })),
      };
    } catch (error) {
      console.error('Erreur pages nyora-sdk:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des pages',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}