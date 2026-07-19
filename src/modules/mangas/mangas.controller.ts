import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MangasService } from './mangas.service';
import { ChaptersService } from './chapters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Controller('mangas')
export class MangasController {
  constructor(
    private readonly mangasService: MangasService,
    private readonly chaptersService: ChaptersService,
  ) {}

  // ============================================
  // CRÉER UN MANGA
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateMangaDto) {
    return this.mangasService.create(req.user.id, dto);
  }

  // ============================================
  // RÉCUPÉRER TOUS LES MANGAS
  // ============================================
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('genre') genre?: string,
    @Query('status') status?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.mangasService.findAll(
      Number.isNaN(pageNumber) ? 1 : pageNumber,
      Number.isNaN(limitNumber) ? 20 : limitNumber,
      { search, genre, status },
    );
  }

  // ============================================
  // TOP MANGA DU MOIS
  // ============================================
  @Get('top')
  async getTop(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.mangasService.getTopMangas(Number.isNaN(limitNumber) ? 10 : limitNumber);
  }

  // ============================================
  // RÉCUPÉRER UN MANGA SPÉCIFIQUE
  // ============================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.mangasService.findById(id);
  }

  // ============================================
  // METTRE À JOUR UN MANGA
  // ============================================
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateMangaDto,
  ) {
    return this.mangasService.update(id, req.user.id, dto);
  }

  // ============================================
  // SUPPRIMER UN MANGA
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.mangasService.delete(id, req.user.id);
  }

  // ============================================
  // AJOUTER UN CHAPITRE (avec upload PDF)
  // ============================================
  @Post(':id/chapters')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf'))
  async addChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Fichier PDF requis');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Le fichier doit être un PDF');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Le PDF doit faire moins de 50MB');
    }

    return this.chaptersService.create(mangaId, req.user.id, dto, file);
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA
  // ============================================
  @Get(':id/chapters')
  async getChapters(@Param('id') mangaId: string) {
    return this.chaptersService.findByManga(mangaId);
  }

  // ============================================
  // RÉCUPÉRER UN CHAPITRE SPÉCIFIQUE
  // ============================================
  @Get(':mangaId/chapters/:number')
  async getChapter(
    @Param('mangaId') mangaId: string,
    @Param('number') number: number,
  ) {
    return this.chaptersService.findByNumber(mangaId, number);
  }
}