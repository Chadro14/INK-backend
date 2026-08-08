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

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateMangaDto) {
    return this.mangasService.create(req.user.id, dto);
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

  // Placé avant :id pour éviter toute collision de route
  @Get('top')
  async getTop(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.mangasService.getTopMangas(Number.isNaN(limitNumber) ? 10 : limitNumber);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Garde-fou pour identifier le problème rapidement dans les logs terminal
    if (!id || id === 'undefined' || id === 'null') {
      throw new BadRequestException(`L'ID de manga transmis est invalide: "${id}"`);
    }
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

  // --- COUVERTURES ---

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

  // --- CHAPITRES ---

  @Post(':id/chapters/upload-urls')
  @UseGuards(JwtAuthGuard)
  async getChapterUploadUrls(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: ChapterUploadUrlsDto,
  ) {
    return this.chaptersService.getChapterUploadUrls(mangaId, dto);
  }

  @Post(':id/chapters/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeChapter(
    @Param('id') mangaId: string,
    @Req() req: any,
    @Body() dto: FinalizeChapterDto,
  ) {
    return this.chaptersService.finalizeChapter(mangaId, req.user.id, dto);
  }
}
