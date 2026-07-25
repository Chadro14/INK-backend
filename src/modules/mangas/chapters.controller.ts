import { Controller, Post, Body, Param, UseInterceptors, UploadedFiles, Req } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';

@Controller('mangas')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Post(':mangaId/chapters')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'pdf', maxCount: 1 },
    { name: 'images', maxCount: 100 },
    { name: 'cover', maxCount: 1 }
  ]))
  async createChapter(
    @Param('mangaId') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto,
    @UploadedFiles() files: any
  ) {
    const userId = req.user?.id; 
    
    return this.chaptersService.create(
      mangaId, 
      userId, 
      dto, 
      files?.pdf?.[0], 
      files?.images, 
      files?.cover?.[0]
    );
  }
}
