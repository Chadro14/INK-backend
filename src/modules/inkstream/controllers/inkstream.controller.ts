// src/modules/inkstream/controllers/inkstream.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { InkstreamService } from '../services/inkstream.service';
import { SearchAnimeDto } from '../dto/search-anime.dto';
import { SyncAnimeDto } from '../dto/sync-anime.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('animes')
export class InkstreamController {
  constructor(
    private readonly inkstreamService: InkstreamService,
    private readonly prisma: PrismaService, // ✅ AJOUTÉ
  ) {}

  // ============================================
  // RECHERCHE D'ANIMES
  // ============================================
  @Get('search')
  async search(@Query() dto: SearchAnimeDto) {
    try {
      return await this.inkstreamService.searchAnimes(dto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // ANIMES POPULAIRES
  // ============================================
  @Get('popular')
  async getPopular() {
    try {
      return await this.inkstreamService.getPopularAnimes();
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des animes populaires',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // ANIMES TENDANCES
  // ============================================
  @Get('trending')
  async getTrending() {
    try {
      return await this.inkstreamService.getTrendingAnimes();
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des animes tendances',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // ANIMES PAR GENRE
  // ============================================
  @Get('genre/:genre')
  async getByGenre(
    @Param('genre') genre: string,
    @Query('limit') limit: number = 20,
  ) {
    try {
      return await this.inkstreamService.getAnimesByGenre(genre, limit);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération par genre',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // DÉTAILS D'UN ANIME
  // ============================================
  @Get(':id')
  async getAnime(@Param('id') id: string) {
    try {
      return await this.inkstreamService.getAnime(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Anime non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================
  // RÉCUPÉRER LA VIDÉO D'UN ÉPISODE (SANS MANAS)
  // ============================================
  @Get(':animeId/episode/:episodeNumber/video')
  async getEpisodeVideo(
    @Param('animeId') animeId: string,
    @Param('episodeNumber') episodeNumber: number,
  ) {
    try {
      return await this.inkstreamService.getEpisodeVideoOnly(animeId, episodeNumber);
    } catch (error) {
      throw new HttpException(
        error.message || 'Vidéo non disponible',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================
  // REGARDER UN ÉPISODE (AVEC MANAS)
  // ============================================
  @Post(':animeId/watch/:episodeNumber')
  @UseGuards(JwtAuthGuard)
  async watchEpisode(
    @Req() req: any,
    @Param('animeId') animeId: string,
    @Param('episodeNumber') episodeNumber: number,
  ) {
    try {
      return await this.inkstreamService.watchEpisode(
        req.user.id,
        animeId,
        episodeNumber,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors du visionnage',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================
  // HISTORIQUE DE VISIONNAGE
  // ============================================
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any) {
    try {
      return await this.inkstreamService.getWatchHistory(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération de l\'historique',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // CONTINUER À REGARDER
  // ============================================
  @Get('continue')
  @UseGuards(JwtAuthGuard)
  async getContinueWatching(@Req() req: any) {
    try {
      const history = await this.inkstreamService.getWatchHistory(req.user.id);
      return history.slice(0, 10);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // SYNC ANIME DEPUIS ANILIST (ADMIN)
  // ============================================
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async syncAnime(@Req() req: any, @Body() dto: SyncAnimeDto) {
    try {
      // Vérifier que l'utilisateur est admin
      const user = await this.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        throw new HttpException('Accès refusé', HttpStatus.FORBIDDEN);
      }

      return await this.inkstreamService.addAnimeFromAnilist(dto.anilistId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la synchronisation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
