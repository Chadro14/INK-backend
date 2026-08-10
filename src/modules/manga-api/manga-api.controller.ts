import { Controller, Get, Query, Param } from '@nestjs/common';
import { MangaApiService } from './manga-api.service';

@Controller('manga-api')
export class MangaApiController {
  constructor(private readonly mangaApiService: MangaApiService) {}

  @Get('popular')
  async getPopular(@Query('limit') limit: string = '20') {
    const mangas = await this.mangaApiService.getPopularManga(parseInt(limit));
    return { success: true, data: mangas };
  }

  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit: string = '20') {
    if (!query) {
      return { error: 'Le paramètre "q" est requis' };
    }
    const mangas = await this.mangaApiService.searchManga(query, parseInt(limit));
    return { success: true, data: mangas };
  }

  @Get(':id')
  async getDetails(@Param('id') id: string) {
    const manga = await this.mangaApiService.getMangaDetails(id);
    return { success: true, data: manga };
  }

  @Get(':id/chapters')
  async getChapters(@Param('id') id: string, @Query('limit') limit: string = '100') {
    const chapters = await this.mangaApiService.getMangaChapters(id, parseInt(limit));
    return { success: true, data: chapters };
  }

  @Get('chapter/:chapterId/pages')
  async getPages(@Param('chapterId') chapterId: string) {
    const pages = await this.mangaApiService.getChapterPages(chapterId);
    return { success: true, data: pages };
  }
}