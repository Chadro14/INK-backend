import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { GetUploadUrlsDto } from './dto/get-upload-urls.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mangas')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  // Route 1 : Demande des URLs signées pour uploader directement vers Supabase Storage
  @Post(':id/chapters/upload-url')
  @UseGuards(JwtAuthGuard)
  async getUploadUrls(
    @Param('id') mangaId: string,
    @Body() dto: GetUploadUrlsDto,
  ) {
    return this.chaptersService.generateSignedUploadUrls(mangaId, dto.filenames);
  }

  // Route 2 : Création du chapitre (reçoit le JSON avec les URLs finales)
  @Post(':id/chapters')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('id') mangaId: string,
    @Request() req,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chaptersService.create(mangaId, req.user.id, dto);
  }

  // Route 3 : Récupérer tous les chapitres d'un manga
  @Get(':id/chapters')
  async findByManga(@Param('id') mangaId: string) {
    return this.chaptersService.findByManga(mangaId);
  }

  // Route 4 : Récupérer un chapitre par son numéro
  @Get(':id/chapters/number/:number')
  async findByNumber(
    @Param('id') mangaId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.chaptersService.findByNumber(mangaId, number);
  }

  // Route 5 : Récupérer un chapitre par son ID
  @Get('chapters/:chapterId')
  async findOne(@Param('chapterId') chapterId: string) {
    return this.chaptersService.findOne(chapterId);
  }

  // Route 6 : Mettre à jour un chapitre
  @Put('chapters/:chapterId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.update(chapterId, dto);
  }

  // Route 7 : Supprimer un chapitre
  @Delete('chapters/:chapterId')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('chapterId') chapterId: string) {
    return this.chaptersService.delete(chapterId);
  }
}
