import { Controller, Post, Body, Param, Req } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';

@Controller('mangas')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Post(':mangaId/chapters')
  async createChapter(
    @Param('mangaId') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto,
  ) {
    const userId = req.user?.id; 

    // Reçoit directement l'objet JSON (contient les liens Supabase)
    return this.chaptersService.create(mangaId, userId, dto);
  }
}
