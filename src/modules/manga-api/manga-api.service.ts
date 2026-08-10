import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MangaApiService {
  private readonly mangaDexApiUrl = 'https://api.mangadex.org';

  constructor(private readonly httpService: HttpService) {}

  // ============================================
  // RÉCUPÉRER LES MANGAS POPULAIRES
  // ============================================
  async getPopularManga(limit: number = 20) {
    const url = `${this.mangaDexApiUrl}/manga`;
    const params = {
      'order[followedCount]': 'desc',
      'limit': limit,
      'includes[]': ['cover_art', 'author'],
      'contentRating[]': ['safe', 'suggestive', 'erotica'],
      'availableTranslatedLanguage[]': ['fr', 'en'],
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      
      return data.data.map((manga: any) => this.formatManga(manga));
    } catch (error) {
      console.error('Erreur MangaDex:', error.message);
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
    const url = `${this.mangaDexApiUrl}/manga`;
    const params = {
      'title': query,
      'limit': limit,
      'includes[]': ['cover_art', 'author'],
      'contentRating[]': ['safe', 'suggestive', 'erotica'],
      'availableTranslatedLanguage[]': ['fr', 'en'],
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      
      return data.data.map((manga: any) => this.formatManga(manga));
    } catch (error) {
      console.error('Erreur recherche MangaDex:', error.message);
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
    const url = `${this.mangaDexApiUrl}/manga/${mangaId}`;
    const params = {
      'includes[]': ['cover_art', 'author', 'artist'],
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      
      return this.formatManga(data.data, true);
    } catch (error) {
      console.error('Erreur détails MangaDex:', error.message);
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
    const url = `${this.mangaDexApiUrl}/manga/${mangaId}/feed`;
    const params = {
      'limit': limit,
      'translatedLanguage[]': ['fr', 'en'],
      'order[chapter]': 'desc',
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      
      return data.data.map((chapter: any) => ({
        id: chapter.id,
        chapter: chapter.attributes.chapter || '0',
        title: chapter.attributes.title || `Chapitre ${chapter.attributes.chapter || '0'}`,
        pages: chapter.attributes.pages || 0,
        publishedAt: chapter.attributes.publishAt || new Date(),
      }));
    } catch (error) {
      console.error('Erreur chapitres MangaDex:', error.message);
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
    const url = `${this.mangaDexApiUrl}/at-home/server/${chapterId}`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url)
      );
      
      const baseUrl = data.baseUrl;
      const chapterHash = data.chapter.hash;
      const filenames = data.chapter.data;

      return {
        pages: filenames.map((filename: string) => ({
          url: `${baseUrl}/data/${chapterHash}/${filename}`,
        })),
      };
    } catch (error) {
      console.error('Erreur pages MangaDex:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des pages',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // FORMATER UN MANGA (CORRIGÉ)
  // ============================================
  private formatManga(manga: any, details: boolean = false) {
    // ✅ TITRE : priorité aux langues disponibles
    const title = manga.attributes.title?.en 
      || manga.attributes.title?.fr 
      || manga.attributes.title?.ja 
      || manga.attributes.title?.ro 
      || 'Titre inconnu';
    
    // ✅ DESCRIPTION : en français ou anglais
    let description = manga.attributes.description?.fr 
      || manga.attributes.description?.en 
      || 'Aucune description disponible.';
    
    // ✅ Si la description fait plus de 300 caractères, la couper
    if (description.length > 300) {
      description = description.slice(0, 300) + '...';
    }
    
    // ✅ COUVERTURE : vérifier si l'image existe
    const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
    let coverUrl = null;
    if (coverArt && coverArt.attributes?.fileName) {
      coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`;
    }

    // ✅ AUTEUR
    const author = manga.relationships?.find((rel: any) => rel.type === 'author');

    // ✅ STATUT en français
    const statusMap: Record<string, string> = {
      'ongoing': 'En cours',
      'completed': 'Terminé',
      'hiatus': 'En pause',
      'cancelled': 'Annulé',
    };

    return {
      id: manga.id,
      title: title,
      description: description,
      coverImage: coverUrl,
      author: author ? {
        id: author.id,
        name: author.attributes?.name || 'Inconnu',
      } : null,
      rating: manga.attributes?.rating ? (manga.attributes.rating / 10).toFixed(1) : null,
      status: statusMap[manga.attributes?.status] || manga.attributes?.status || 'Inconnu',
      year: manga.attributes?.year || null,
      genres: manga.attributes?.tags?.map((tag: any) => {
        return tag.attributes?.name?.en || tag.attributes?.name?.fr || tag.attributes?.name?.ja || 'Inconnu';
      }) || [],
      ...(details && {
        chapters: manga.attributes?.chapters || 0,
        createdAt: manga.attributes?.createdAt || null,
      }),
    };
  }
}