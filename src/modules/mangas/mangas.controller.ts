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
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MangasService } from './mangas.service';
import { ChaptersService } from './chapters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('mangas')
export class MangasController {
  constructor(
    private readonly mangasService: MangasService,
    private readonly chaptersService: ChaptersService,
    private readonly prisma: PrismaService,
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
  // OBTENIR L'URL SIGNÉE POUR LA COUVERTURE
  // ============================================
  @Post(':id/cover/upload-url')
  @UseGuards(JwtAuthGuard)
  async getCoverUploadUrl(
    @Param('id') mangaId: string,
    @Req() req: any,
  ) {
    return this.mangasService.getCoverUploadUrl(mangaId, req.user.id);
  }

  // ============================================
  // FINALISER LA COUVERTURE
  // ============================================
  @Post(':id/cover/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeCover(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() body: { key: string },
  ) {
    if (!body.key) {
      throw new BadRequestException('La clé du fichier (key) est requise');
    }
    return this.mangasService.finalizeCover(mangaId, req.user.id, body.key);
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
  // OBTENIR DES URLS D'UPLOAD SIGNÉES POUR CHAPITRES
  // ============================================
  @Post(':id/chapters/upload-urls')
  @UseGuards(JwtAuthGuard)
  async getChapterUploadUrls(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() body: { mode: 'pdf' | 'photos'; count: number; chapterNumber: number },
  ) {
    return this.chaptersService.generateUploadUrls(
      mangaId,
      req.user.id,
      body.mode,
      body.count,
      body.chapterNumber,
    );
  }

  // ============================================
  // FINALISER UN CHAPITRE
  // ============================================
  @Post(':id/chapters/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto & { mode: 'pdf' | 'photos'; keys: string[] },
  ) {
    return this.chaptersService.createFromKeys(mangaId, req.user.id, dto);
  }

  // ============================================
  // AJOUTER UN CHAPITRE (Classique)
  // ============================================
  @Post(':id/chapters')
  @UseGuards(JwtAuthGuard)
  async addChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: CreateChapterDto,
  ) {
    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }
    if (manga.authorId !== req.user.id) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: (dto as any).number,
        title: (dto as any).title,
        isFree: (dto as any).isFree ?? true,
        price: (dto as any).price || 0,
      },
    });
  }

  // ============================================
  // GÉNÉRER LES URLS D'UPLOAD DIRECT (Alternative)
  // ============================================
  @Post(':id/chapters/upload-url')
  @UseGuards(JwtAuthGuard)
  async getUploadUrls(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() body: { filenames: string[]; fileNames?: string[] },
  ) {
    const filenames = body.filenames || body.fileNames;

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      throw new BadRequestException('Aucun nom de fichier fourni.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (manga.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    return this.mangasService.getUploadUrls(mangaId, filenames);
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA
  // ============================================
  @Get(':id/chapters')
  async getChapters(@Param('id') mangaId: string) {
    const manga = await this.mangasService.findById(mangaId);
    return manga.chapters;
  }

  // ============================================
  // RÉCUPÉRER UN CHAPITRE SPÉCIFIQUE
  // ============================================
  @Get(':mangaId/chapters/:number')
  async getChapter(
    @Param('mangaId') mangaId: string,
    @Param('number') number: string,
  ) {
    const chapterNumber = parseInt(number, 10);
    const chapter = await this.prisma.chapter.findFirst({
      where: { mangaId, number: chapterNumber },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    return chapter;
  }
}
