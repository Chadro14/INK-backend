import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { InkstreamService } from '../services/inkstream.service';
import { SearchAnimeDto } from '../dto/search-anime.dto';

@Controller('inkstream')
export class InkstreamController {
  constructor(private readonly inkstreamService: InkstreamService) {}

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  @Get('search')
  async search(@Query() dto: SearchAnimeDto) {
    return this.inkstreamService.searchAnimes(dto);
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  @Get('popular')
  async getPopular() {
    return this.inkstreamService.getPopularAnimes();
  }

  // ============================================
  // RÉCUPÉRER UN ANIME PAR ID
  // ============================================
  @Get(':id')
  async getAnime(@Param('id') id: string) {
    return this.inkstreamService.getAnime(id);
  }

  // ============================================
  // REGARDER UN ÉPISODE
  // ============================================
  @Post(':animeId/watch/:episodeNumber')
  @UseGuards(JwtAuthGuard)
  async watchEpisode(
    @Req() req,
    @Param('animeId') animeId: string,
    @Param('episodeNumber') episodeNumber: number,
  ) {
    return this.inkstreamService.watchEpisode(
      req.user.id,
      animeId,
      episodeNumber,
    );
  }

  // ============================================
  // SAUVEGARDER LA PROGRESSION
  // ============================================
  @Post('progress/:episodeId')
  @UseGuards(JwtAuthGuard)
  async saveProgress(
    @Req() req,
    @Param('episodeId') episodeId: string,
    @Body() body: { progress: number },
  ) {
    return this.inkstreamService.saveProgress(
      req.user.id,
      episodeId,
      body.progress,
    );
  }
}