import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MangaApiService {
  private readonly mangaDexApiUrl = 'https://api.mangadex.org';
  private readonly proxyUrls = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://proxy.cors.sh/?',
  ];

  constructor(private readonly httpService: HttpService) {}

  // ============================================
  // RECHERCHER DES MANGAS VIA MANGADEX
  // ============================================
  async searchMangaDex(query: string, limit: number = 20) {
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
      console.error('Erreur MangaDex:', error.message);
      throw new HttpException(
        'Erreur lors de la recherche de mangas',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER UN MANGA PAR ID
  // ============================================
  async getMangaById(id: string) {
    const url = `${this.mangaDexApiUrl}/manga/${id}`;
    const params = {
      'includes[]': ['cover_art', 'author', 'artist'],
    };

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { params })
      );
      
      return this.formatManga(data.data, true);
    } catch (error) {
      console.error('Erreur MangaDex:', error.message);
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
  // RÉCUPÉRER LES PAGES D'UN CHAPITRE (AVEC PROXY FALLBACK)
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

      if (!filenames || filenames.length === 0) {
        throw new HttpException(
          'Aucune page disponible pour ce chapitre',
          HttpStatus.NOT_FOUND,
        );
      }

      // ✅ Générer les URLs avec différents proxies pour plus de robustesse
      const pages = filenames.map((filename: string) => {
        const originalUrl = `${baseUrl}/data/${chapterHash}/${filename}`;
        // Utiliser le premier proxy disponible
        const proxyUrl = `${this.proxyUrls[0]}${encodeURIComponent(originalUrl)}`;
        return { url: proxyUrl };
      });

      return { pages };
    } catch (error) {
      console.error('Erreur pages MangaDex:', error.message);
      throw new HttpException(
        'Erreur lors de la récupération des pages',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================
  // FORMATER UN MANGA (avec proxy et chapitres)
  // ============================================
  private formatManga(manga: any, details: boolean = false) {
    const title = manga.attributes.title?.fr 
      || manga.attributes.title?.en 
      || manga.attributes.title?.ja 
      || 'Titre inconnu';
    
    let description = manga.attributes.description?.fr 
      || manga.attributes.description?.en 
      || 'Aucune description disponible.';
    
    if (description.length > 300) {
      description = description.slice(0, 300) + '...';
    }
    
    // ✅ Couverture avec proxy
    const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
    let coverUrl = null;
    if (coverArt && coverArt.attributes?.fileName) {
      const originalUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`;
      coverUrl = `${this.proxyUrls[0]}${encodeURIComponent(originalUrl)}`;
    }

    const author = manga.relationships?.find((rel: any) => rel.type === 'author');

    const statusMap: Record<string, string> = {
      'ongoing': 'En cours',
      'completed': 'Terminé',
      'hiatus': 'En pause',
      'cancelled': 'Annulé',
    };

    const genres = manga.attributes?.tags?.map((tag: any) => {
      return tag.attributes?.name?.fr || tag.attributes?.name?.en || 'Inconnu';
    }) || [];

    const rating = manga.attributes?.rating ? (manga.attributes.rating / 10).toFixed(1) : null;

    // ✅ RÉCUPÉRER LE NOMBRE DE CHAPITRES
    const chaptersCount = manga.attributes?.chapters || 0;

    return {
      id: manga.id,
      title: title,
      description: description,
      coverImage: coverUrl,
      author: author ? {
        id: author.id,
        name: author.attributes?.name || 'Inconnu',
      } : null,
      rating: rating,
      status: statusMap[manga.attributes?.status] || manga.attributes?.status || 'Inconnu',
      year: manga.attributes?.year || null,
      genres: genres,
      chapters: chaptersCount, // ✅ AJOUTÉ
      source: 'mangadex',
      ...(details && {
        chapters: chaptersCount,
        createdAt: manga.attributes?.createdAt || null,
      }),
    };
  }
}
