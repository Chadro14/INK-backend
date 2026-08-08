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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import {
  CreateChapterDto,
  ChapterUploadUrlsDto,
  FinalizeChapterDto,
} from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('mangas/:mangaId/chapters')
export class ChaptersController {
  constructor(
    private readonly chaptersService: ChaptersService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // 1. Demande d'URLs d'upload signées pour Supabase Storage
  // ============================================
  @Post('upload-urls')
  @UseGuards(JwtAuthGuard)
  async generateUploadUrls(
    @Param('mangaId') mangaId: string,
    @Body() dto: ChapterUploadUrlsDto,
  ) {
    return this.chaptersService.getChapterUploadUrls(mangaId, dto);
  }

  // ============================================
  // 2. Finalisation du chapitre dans la BDD
  // ============================================
  @Post('finalize')
  @UseGuards(JwtAuthGuard)
  async createFinalized(
    @Param('mangaId') mangaId: string,
    @Request() req: any,
    @Body() finalizeChapterDto: FinalizeChapterDto,
  ) {
    return this.chaptersService.finalizeChapter(
      mangaId,
      req.user.id,
      finalizeChapterDto,
    );
  }

  // ============================================
  // 3. Création classique / directe d'un chapitre
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('mangaId') mangaId: string,
    @Request() req: any,
    @Body() createChapterDto: CreateChapterDto,
  ) {
    return this.chaptersService.create(mangaId, req.user.id, createChapterDto);
  }

  // ============================================
  // 4. Récupérer tous les chapitres d'un manga
  // ============================================
  @Get()
  async findByManga(@Param('mangaId') mangaId: string) {
    return this.chaptersService.findByManga(mangaId);
  }

  // ============================================
  // 5. Récupérer un chapitre par son NUMÉRO
  // ⚠️ ROUTE SPÉCIFIQUE : doit être AVANT @Get(':chapterId')
  // ============================================
  @Get('number/:number')
  async findByNumber(
    @Param('mangaId') mangaId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.chaptersService.findByNumber(mangaId, number);
  }

  // ============================================
  // 6. PUBLIER un chapitre (passer de draft à publié)
  // ⚠️ ROUTE SPÉCIFIQUE : doit être AVANT @Get(':chapterId')
  // ============================================
  @Patch(':chapterId/publish')
  @UseGuards(JwtAuthGuard)
  async publishChapter(
    @Param('mangaId') mangaId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    // 1. Vérifier que le chapitre existe
    const chapter = await this.chaptersService.findOne(chapterId);
    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé.');
    }

    // 2. Vérifier que le manga existe et que l'utilisateur est l'auteur
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { authorId: true },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé.');
    }

    if (manga.authorId !== req.user.id) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    // 3. Publier le chapitre (passer isDraft à false)
    return this.chaptersService.update(chapterId, {
      isDraft: false,
    });
  }

  // ============================================
  // 7. Récupérer un chapitre par son ID
  // ⚠️ ROUTE GÉNÉRIQUE : doit être EN DERNIER
  // ============================================
  @Get(':chapterId')
  async findOne(@Param('chapterId') chapterId: string) {
    return this.chaptersService.findOne(chapterId);
  }

  // ============================================
  // 8. Mettre à jour un chapitre
  // ============================================
  @Patch(':chapterId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('chapterId') chapterId: string,
    @Body() updateChapterDto: UpdateChapterDto,
  ) {
    return this.chaptersService.update(chapterId, updateChapterDto);
  }

  // ============================================
  // 9. Supprimer un chapitre
  // ============================================
  @Delete(':chapterId')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('chapterId') chapterId: string) {
    return this.chaptersService.delete(chapterId);
  }
}
