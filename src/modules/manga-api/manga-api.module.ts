import { Controller, Get, Query, Param } from '@nestjs/common';
import { MangaApiService } from './manga-api.service';

@Controller('manga-api')
export class MangaApiController {
  constructor(private readonly mangaApiService: MangaApiService) {}

  // ============================================
  // RECHERCHER DES MANGAS PAR TITRE
  // ============================================
  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit: string = '20') {
    if (!query) {
      return { error: 'Le paramètre "q" est requis' };
    }
    const mangas = await this.mangaApiService.searchMangaByTitle(query, parseInt(limit));
    return { success: true, data: mangas };
  }

  // ============================================
  // RÉCUPÉRER UN MANGA PAR ID
  // ============================================
  @Get(':id')
  async getDetails(@Param('id') id: string) {
    const manga = await this.mangaApiService.getMangaById(id);
    return { success: true, data: manga };
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA
  // ============================================
  @Get(':id/chapters')
  async getChapters(@Param('id') id: string, @Query('limit') limit: string = '100') {
    const chapters = await this.mangaApiService.getMangaChapters(id, parseInt(limit));
    return { success: true, data: chapters };
  }

  // ============================================
  // RÉCUPÉRER LES PAGES D'UN CHAPITRE
  // ============================================
  @Get('chapter/:chapterId/pages')
  async getPages(@Param('chapterId') chapterId: string) {
    const pages = await this.mangaApiService.getChapterPages(chapterId);
    return { success: true, data: pages };
  }
}