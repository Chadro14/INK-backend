import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MANGA } from '@consumet/extensions';

@Injectable()
export class MangaApiService {
  private mangaProvider: any;

  constructor() {
    this.mangaProvider = new MANGA.MangaDex();
  }

  // ============================================
  // RÉCUPÉRER LES MANGAS POPULAIRES
  // ============================================
  async getPopularManga(limit: number = 20) {
    try {
      const result = await this.mangaProvider.fetchPopularManga(limit);

      return result.results.map((manga: any) => ({
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.image || manga.cover || null,
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
      console.error('Erreur Consumet:', error.message);
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
      const result = await this.mangaProvider.search(query, limit);

      return result.results.map((manga: any) => ({
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.image || manga.cover || null,
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
      console.error('Erreur recherche Consumet:', error.message);
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
      const manga = await this.mangaProvider.fetchMangaInfo(mangaId);

      return {
        id: manga.id,
        title: manga.title || 'Titre inconnu',
        description: manga.description || 'Aucune description disponible.',
        coverImage: manga.image || manga.cover || null,
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
      console.error('Erreur détails Consumet:', error.message);
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
      const chapters = await this.mangaProvider.fetchChapterList(mangaId);

      return chapters.slice(0, limit).map((chapter: any) => ({
        id: chapter.id,
        chapter: chapter.number || '0',
        title: chapter.title || `Chapitre ${chapter.number || '0'}`,
        pages: chapter.pages || 0,
        publishedAt: chapter.publishedAt || new Date(),
      }));
    } catch (error) {
      console.error('Erreur chapitres Consumet:', error.message);
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
      const pages = await this.mangaProvider.fetchChapterPages(chapterId);

      return {
        pages: pages.map((page: any) => ({
          url: page.img || page.image || page.url,
        })),
      };
    } catch (error) {
      console.error('Erreur pages Consumet:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des pages',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}