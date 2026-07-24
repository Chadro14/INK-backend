import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { InkstreamService } from '../services/inkstream.service';
import { SearchAnimeDto } from '../dto/search-anime.dto';

@Controller('inkstream')
export class InkstreamController {
  constructor(private readonly inkstreamService: InkstreamService) {}

  @Get('search')
  async search(@Query() dto: SearchAnimeDto) {
    return this.inkstreamService.searchAnimes(dto);
  }

  @Get('popular')
  async getPopular() {
    return this.inkstreamService.getPopularAnimes();
  }

  @Get(':id')
  async getAnime(@Param('id') id: string) {
    return this.inkstreamService.getAnime(id);
  }

  @Post(':animeId/watch/:episodeNumber')
  @UseGuards(JwtAuthGuard)
  async watchEpisode(
    @Req() req: any,
    @Param('animeId') animeId: string,
    @Param('episodeNumber') episodeNumber: number,
  ) {
    return this.inkstreamService.watchEpisode(
      req.user.id,
      animeId,
      episodeNumber,
    );
  }
}