import { Controller, Get, Query, Param } from '@nestjs/common';
import { MangaApiService } from './manga-api.service';

@Controller('manga-api')
export class MangaApiController {
  constructor(private readonly mangaApiService: MangaApiService) {}

  // ============================================
  // RECHERCHE
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
  // DÉTAILS D'UN MANGA
  // ============================================
  @Get(':id')
  async getDetails(@Param('id') id: string) {
    const manga = await this.mangaApiService.getMangaById(id);
    return { success: true, data: manga };
  }

  // ============================================
  // CHAPITRES D'UN MANGA
  // ============================================
  @Get(':id/chapters')
  async getChapters(@Param('id') id: string, @Query('limit') limit: string = '100') {
    const chapters = await this.mangaApiService.getMangaChapters(id, parseInt(limit));
    return { success: true, data: chapters };
  }

  // ============================================
  // PAGES D'UN CHAPITRE
  // ============================================
  @Get('chapter/:chapterId/pages')
  async getPages(@Param('chapterId') chapterId: string) {
    const pages = await this.mangaApiService.getChapterPages(chapterId);
    return { success: true, data: pages };
  }
}
