// src/modules/manga-api/manga-api.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MangaApiService {
  private readonly mangaDexApiUrl = 'https://api.mangadex.org';

  constructor(private readonly httpService: HttpService) {}

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

  private formatManga(manga: any) {
    // Récupérer l'URL de la couverture
    const coverArt = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
    const coverUrl = coverArt 
      ? `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`
      : null;

    // Récupérer l'auteur
    const author = manga.relationships?.find((rel: any) => rel.type === 'author');

    return {
      id: manga.id,
      title: manga.attributes.title?.en || 'Sans titre',
      description: manga.attributes.description?.en || '',
      coverImage: coverUrl,
      author: author ? {
        id: author.id,
        name: author.attributes?.name || 'Inconnu',
      } : null,
      rating: manga.attributes?.rating || null,
      status: manga.attributes?.status || 'unknown',
      year: manga.attributes?.year || null,
      genres: manga.attributes?.tags?.map((tag: any) => tag.attributes?.name?.en) || [],
    };
  }
}
