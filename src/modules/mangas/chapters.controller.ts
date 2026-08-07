import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

// ✅ Chemin exact pointant vers src/common/guards/jwt-auth.guard.ts
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('mangas/:mangaId/chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  // 1. Demande d'URLs d'upload signées pour Supabase Storage
  @Post('upload-urls')
  @UseGuards(JwtAuthGuard)
  async generateUploadUrls(
    @Param('mangaId') mangaId: string,
    @Body('filenames') filenames: string[],
  ) {
    return this.chaptersService.generateSignedUploadUrls(mangaId, filenames);
  }

  // 2. Finalisation / Création du chapitre dans la BDD
  @Post('finalize')
  @UseGuards(JwtAuthGuard)
  async createFinalized(
    @Param('mangaId') mangaId: string,
    @Request() req: any,
    @Body() createChapterDto: CreateChapterDto,
  ) {
    return this.chaptersService.create(mangaId, req.user.id, createChapterDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('mangaId') mangaId: string,
    @Request() req: any,
    @Body() createChapterDto: CreateChapterDto,
  ) {
    return this.chaptersService.create(mangaId, req.user.id, createChapterDto);
  }

  // 3. Récupérer tous les chapitres d'un manga
  @Get()
  async findByManga(@Param('mangaId') mangaId: string) {
    return this.chaptersService.findByManga(mangaId);
  }

  // 4. Récupérer un chapitre par son numéro
  @Get('number/:number')
  async findByNumber(
    @Param('mangaId') mangaId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.chaptersService.findByNumber(mangaId, number);
  }

  // 5. Récupérer un chapitre par son ID
  @Get(':chapterId')
  async findOne(@Param('chapterId') chapterId: string) {
    return this.chaptersService.findOne(chapterId);
  }

  // 6. Mettre à jour un chapitre
  @Patch(':chapterId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('chapterId') chapterId: string,
    @Body() updateChapterDto: UpdateChapterDto,
  ) {
    return this.chaptersService.update(chapterId, updateChapterDto);
  }

  // 7. Supprimer un chapitre
  @Delete(':chapterId')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('chapterId') chapterId: string) {
    return this.chaptersService.delete(chapterId);
  }
}
