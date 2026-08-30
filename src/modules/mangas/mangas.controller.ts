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
  Patch,
} from '@nestjs/common';
import { MangasService } from './mangas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { Status } from '@prisma/client';

@Controller('mangas')
export class MangasController {
  constructor(private readonly mangasService: MangasService) {}

  // ============================================
  // 1. CRÉER UN MANGA
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateMangaDto) {
    const manga = await this.mangasService.create(req.user.id, dto);
    return { success: true, data: manga };
  }

  // ============================================
  // 2. LISTE DES MANGAS (PAGINÉE)
  // ============================================
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('genre') genre?: string,
    @Query('status') status?: string,
  ) {
    const filters = { search, genre, status };
    const result = await this.mangasService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      filters,
    );
    return { success: true, ...result };
  }

  // ============================================
  // 3. TOP MANGAS
  // ============================================
  @Get('top')
  async getTopMangas(@Query('limit') limit?: string) {
    const mangas = await this.mangasService.getTopMangas(limit ? parseInt(limit) : 10);
    return { success: true, data: mangas };
  }

  // ============================================
  // 4. RECHERCHER UN MANGA PAR ID OU SLUG
  // ============================================
  @Get(':identifier')
  async findOne(@Param('identifier') identifier: string) {
    const manga = await this.mangasService.findByIdOrSlug(identifier);
    return { success: true, data: manga };
  }

  // ============================================
  // 5. METTRE À JOUR UN MANGA
  // ============================================
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateMangaDto,
  ) {
    const manga = await this.mangasService.update(id, req.user.id, dto);
    return { success: true, data: manga };
  }

  // ============================================
  // 6. SUPPRIMER UN MANGA
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    const result = await this.mangasService.delete(id, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 7. INCRÉMENTER LES VUES
  // ============================================
  @Post(':identifier/view')
  async incrementView(@Param('identifier') identifier: string, @Req() req: any) {
    const userId = req.user?.id;
    const result = await this.mangasService.incrementView(identifier, userId);
    return { success: true, ...result };
  }

  // ============================================
  // 8. URLS D'UPLOAD POUR LA COUVERTURE
  // ============================================
  @Post(':id/cover/upload-url')
  @UseGuards(JwtAuthGuard)
  async getCoverUploadUrl(@Param('id') id: string, @Req() req: any) {
    const result = await this.mangasService.getCoverUploadUrl(id, req.user.id);
    return { success: true, data: result };
  }

  // ============================================
  // 9. FINALISER LA COUVERTURE
  // ============================================
  @Post(':id/cover/finalize')
  @UseGuards(JwtAuthGuard)
  async finalizeCover(
    @Param('id') id: string,
    @Req() req: any,
    @Body('key') key: string,
  ) {
    const manga = await this.mangasService.finalizeCover(id, req.user.id, key);
    return { success: true, data: manga };
  }

  // ============================================
  // 10. URLS D'UPLOAD POUR LES CHAPITRES
  // ============================================
  @Post(':id/upload-urls')
  @UseGuards(JwtAuthGuard)
  async getUploadUrls(
    @Param('id') id: string,
    @Req() req: any,
    @Body('filenames') filenames: string[],
  ) {
    const result = await this.mangasService.getUploadUrls(id, filenames);
    return { success: true, data: result };
  }

  // ============================================
  // 11. METTRE À JOUR LE SLUG
  // ============================================
  @Patch(':id/slug')
  @UseGuards(JwtAuthGuard)
  async updateSlug(
    @Param('id') id: string,
    @Req() req: any,
    @Body('slug') slug: string,
  ) {
    const manga = await this.mangasService.updateSlug(id, slug, req.user.id);
    return { success: true, data: manga };
  }

  // ============================================
  // 12. MIGRER LES SLUGS (ADMIN)
  // ============================================
  @Post('migrate-slugs')
  @UseGuards(JwtAuthGuard)
  async migrateSlugs(@Req() req: any) {
    const user = await this.mangasService['prisma'].user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return { success: false, message: 'Accès réservé aux administrateurs' };
    }

    const result = await this.mangasService.migrateSlugs();
    return { success: true, ...result };
  }

  // ============================================
  // ✅ 13. RÉCUPÉRER LES MANGAS D'UN CRÉATEUR AVEC STATS
  // ============================================
  @Get('creator/:userId')
  @UseGuards(JwtAuthGuard)
  async getCreatorMangas(@Param('userId') userId: string) {
    const result = await this.mangasService.getCreatorMangasWithStats(userId);
    return { 
      success: true, 
      data: result.mangas, 
      totals: result.totals 
    };
  }

  // ============================================
  // ✅ 14. VÉRIFIER SI ON PEUT PUBLIER UN CHAPITRE PAYANT
  // ============================================
  @Get(':identifier/can-publish-paid')
  @UseGuards(JwtAuthGuard)
  async canPublishPaidChapter(
    @Param('identifier') identifier: string,
    @Req() req: any,
  ) {
    const manga = await this.mangasService.findByIdOrSlug(identifier);
    const result = await this.mangasService.canPublishPaidChapter(
      req.user.id,
      manga.id,
    );
    return { success: true, ...result };
  }

  // ============================================
  // ✅ 15. RÉCUPÉRER LA POSITION D'UN MANGA
  // ============================================
  @Get(':identifier/position')
  @UseGuards(JwtAuthGuard)
  async getMangaPosition(
    @Param('identifier') identifier: string,
    @Req() req: any,
  ) {
    const manga = await this.mangasService.findByIdOrSlug(identifier);
    
    if (manga.authorId !== req.user.id) {
      return { 
        success: false, 
        message: "Vous n'êtes pas l'auteur de ce manga." 
      };
    }
    
    const { position, isPaidPosition } = await this.mangasService.getMangaPosition(
      req.user.id,
      manga.id,
    );
    
    return {
      success: true,
      data: {
        position,
        isPaidPosition,
        canHavePaidChapters: isPaidPosition,
        message: isPaidPosition 
          ? `Position ${position} (impaire) - Vous pouvez publier des chapitres payants.`
          : `Position ${position} (paire) - Ce manga doit être gratuit.`,
      },
    };
  }
}
