
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
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MangasService } from './mangas.service';
import { ChaptersService } from './chapters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { StorageService } from '../../common/services/storage.service';

@Controller('mangas')
export class MangasController {
  constructor(
    private readonly mangasService: MangasService,
    private readonly chaptersService: ChaptersService,
    private readonly storage: StorageService,
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
  // AJOUTER UN CHAPITRE
  // ============================================
  @Post(':id/chapters')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'pdf', maxCount: 1 },
    { name: 'photos', maxCount: 60 },
    { name: 'cover', maxCount: 1 },
  ]))
  async addChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto,
    @UploadedFiles() files: {
      pdf?: Express.Multer.File[];
      photos?: Express.Multer.File[];
      cover?: Express.Multer.File[];
    },
  ) {
    const pdfFile = files.pdf?.[0];
    const photoFiles = files.photos;
    const coverFile = files.cover?.[0];

    if (pdfFile && pdfFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Le fichier doit être un PDF');
    }

    if (pdfFile && pdfFile.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Le PDF doit faire moins de 50MB');
    }

    return this.chaptersService.create(mangaId, req.user.id, dto, pdfFile, photoFiles, coverFile);
  }

  // ============================================
  // GÉNÉRER UNE URL D'UPLOAD DIRECT
  // ============================================
  @Post(':id/chapters/upload-url')
  @UseGuards(JwtAuthGuard)
  async getUploadUrl(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() body: { fileName: string; fileType: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (manga.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    // Stocker dans le bucket "chapters"
    const key = `manga/${mangaId}/${body.fileName}`;
    const uploadUrl = await this.storage.getUploadUrl(key, body.fileType, 'chapters');

    return { uploadUrl, key };
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
