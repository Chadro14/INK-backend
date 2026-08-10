import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { InkstreamService } from './inkstream.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('inkstream')
export class InkstreamController {
  constructor(private readonly inkstreamService: InkstreamService) {}

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  @Get('popular')
  @UseGuards(JwtAuthGuard)
  async getPopular(@Query('limit') limit: string = '10') {
    const animes = await this.inkstreamService.getPopularAnimes(parseInt(limit));
    return { success: true, data: animes };
  }

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('q') query: string, @Query('limit') limit: string = '10') {
    if (!query) {
      return { error: 'Le paramètre "q" est requis' };
    }
    const animes = await this.inkstreamService.searchAnimes(query, parseInt(limit));
    return { success: true, data: animes };
  }

  // ============================================
  // RÉCUPÉRER LES DÉTAILS D'UN ANIME
  // ============================================
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDetails(@Param('id') id: string) {
    const details = await this.inkstreamService.getAnimeDetails(id);
    return { success: true, data: details };
  }

  // ============================================
  // RÉCUPÉRER LE LIEN DE STREAMING
  // ============================================
  @Get(':id/stream')
  @UseGuards(JwtAuthGuard)
  async getStream(
    @Param('id') id: string,
    @Query('episode') episode: string = '1',
  ) {
    const stream = await this.inkstreamService.getStreamUrl(id, parseInt(episode));
    return { success: true, data: stream };
  }
}