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
import {
  CreateChapterDto,
  ChapterUploadUrlsDto,
  FinalizeChapterDto,
} from './dto/create-chapter.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('mangas')
export class MangasController {
  constructor(
    private readonly mangasService: MangasService,
    private readonly chaptersService: ChaptersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateMangaDto) {
    return this.mangasService.create(req.user.id, dto);
  }

  @Post(':id/cover/upload-url')
  @UseGuards(JwtAuthGuard)
  async getCoverUploadUrl(
    @Param('id') mangaId: string,
    @Req() req: any,
  ) {
    return this.mangasService.getCoverUploadUrl(mangaId, req.user.id);
  }

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

  @Get('top')
  async getTop(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.mangasService.getTopMangas(Number.isNaN(limitNumber) ? 10 : limitNumber);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.mangasService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateMangaDto,
  ) {
    return this.mangasService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.mangasService.delete(id, req.user.id);
  }

  // 1. Obtenir les URLs/Tokens de téléversement pour le chapitre (mode photos ou pdf)
  @Post(':id/chapters/upload-urls')
  @UseGuards(JwtAuthGuard)
  async getChapterUploadUrls(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: ChapterUploadUrlsDto,
  ) {
    return this.chaptersService.getChapterUploadUrls(mangaId, dto);
  }

  // 2. Finaliser la création du chapitre avec validation des règles de prix
  @Post(':id/chapters/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: FinalizeChapterDto,
  ) {
    return this.chaptersService.finalizeChapter(mangaId, req.user.id, dto);
  }

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

  @Get(':id/chapters')
  async getChapters(@Param('id') mangaId: string) {
    return this.prisma.chapter.findMany({
      where: { mangaId },
      orderBy: { number: 'asc' },
    });
  }

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
