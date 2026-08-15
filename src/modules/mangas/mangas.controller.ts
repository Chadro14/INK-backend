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
} from '@nestjs/common';
import { MangasService } from './mangas.service';
import { ChaptersService } from './chapters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import {
  CreateChapterDto,
  ChapterUploadUrlsDto,
  FinalizeChapterDto,
} from './dto/create-chapter.dto';

@Controller('mangas')
export class MangasController {
  constructor(
    private readonly mangasService: MangasService,
    private readonly chaptersService: ChaptersService,
  ) {}

  // ============================================
  // 1. CRÉER UN MANGA
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateMangaDto) {
    return this.mangasService.create(req.user.id, dto);
  }

  // ============================================
  // 2. LISTE DES MANGAS (avec filtres)
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
  // 3. TOP MANGAS (par popularité)
  // ============================================
  @Get('top')
  async getTop(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.mangasService.getTopMangas(Number.isNaN(limitNumber) ? 10 : limitNumber);
  }

  // ============================================
  // 4. RECHERCHER UN MANGA PAR ID OU SLUG
  // ============================================
  @Get(':identifier')
  async findOne(@Param('identifier') identifier: string) {
    // ✅ Garde-fou pour identifier le problème rapidement
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    
    // ✅ Utiliser la méthode unifiée (ID ou Slug)
    return this.mangasService.findByIdOrSlug(identifier);
  }

  // ============================================
  // 5. METTRE À JOUR UN MANGA
  // ============================================
  @Put(':identifier')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('identifier') identifier: string,
    @Req() req: any,
    @Body() dto: UpdateMangaDto,
  ) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    return this.mangasService.update(identifier, req.user.id, dto);
  }

  // ============================================
  // 6. SUPPRIMER UN MANGA
  // ============================================
  @Delete(':identifier')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('identifier') identifier: string, @Req() req: any) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    return this.mangasService.delete(identifier, req.user.id);
  }

  // ============================================
  // 7. COUVERTURES - URL D'UPLOAD
  // ============================================
  @Post(':identifier/cover/upload-url')
  @UseGuards(JwtAuthGuard)
  async getCoverUploadUrl(
    @Param('identifier') identifier: string,
    @Req() req: any,
  ) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    return this.mangasService.getCoverUploadUrl(identifier, req.user.id);
  }

  // ============================================
  // 8. COUVERTURES - FINALISATION
  // ============================================
  @Post(':identifier/cover/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeCover(
    @Param('identifier') identifier: string,
    @Req() req: any,
    @Body() body: { key: string },
  ) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    if (!body.key) {
      throw new BadRequestException('La clé du fichier (key) est requise');
    }
    return this.mangasService.finalizeCover(identifier, req.user.id, body.key);
  }

  // ============================================
  // 9. CHAPITRES - URLS D'UPLOAD
  // ============================================
  @Post(':identifier/chapters/upload-urls')
  @UseGuards(JwtAuthGuard)
  async getChapterUploadUrls(
    @Param('identifier') identifier: string,
    @Req() req: any,
    @Body() dto: ChapterUploadUrlsDto,
  ) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    return this.chaptersService.getChapterUploadUrls(identifier, dto);
  }

  // ============================================
  // 10. CHAPITRES - FINALISATION
  // ============================================
  @Post(':identifier/chapters/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeChapter(
    @Param('identifier') identifier: string,
    @Req() req: any,
    @Body() dto: FinalizeChapterDto,
  ) {
    if (!identifier || identifier === 'undefined' || identifier === 'null') {
      throw new BadRequestException(`L'identifiant du manga est invalide: "${identifier}"`);
    }
    return this.chaptersService.finalizeChapter(identifier, req.user.id, dto);
  }
}
