import { Controller, Get, Query, Param } from '@nestjs/common';
import { MangaApiService } from './manga-api.service';

@Controller('manga-api')
export class MangaApiController {
  constructor(private readonly mangaApiService: MangaApiService) {}

  // ============================================
  // MANGAS POPULAIRES VIA KITSU
  // ============================================
  @Get('popular')
  async getPopular(@Query('limit') limit: string = '20') {
    const mangas = await this.mangaApiService.getPopularMangaKitsu(parseInt(limit));
    return { success: true, data: mangas };
  }

  // ============================================
  // RECHERCHE VIA MANGADEX
  // ============================================
  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit: string = '20') {
    if (!query) {
      return { error: 'Le paramètre "q" est requis' };
    }
    const mangas = await this.mangaApiService.searchMangaDex(query, parseInt(limit));
    return { success: true, data: mangas };
  }

  // ============================================
  // RÉCUPÉRER UN MANGA PAR ID (MangaDex)
  // ============================================
  @Get(':id')
  async getDetails(@Param('id') id: string) {
    const manga = await this.mangaApiService.getMangaById(id);
    return { success: true, data: manga };
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA (MangaDex)
  // ============================================
  @Get(':id/chapters')
  async getChapters(@Param('id') id: string, @Query('limit') limit: string = '100') {
    const chapters = await this.mangaApiService.getMangaChapters(id, parseInt(limit));
    return { success: true, data: chapters };
  }

  // ============================================
  // RÉCUPÉRER LES PAGES D'UN CHAPITRE (MangaDex)
  // ============================================
  @Get('chapter/:chapterId/pages')
  async getPages(@Param('chapterId') chapterId: string) {
    const pages = await this.mangaApiService.getChapterPages(chapterId);
    return { success: true, data: pages };
  }
}