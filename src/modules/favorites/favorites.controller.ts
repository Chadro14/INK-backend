import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post('toggle/:mangaId')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(@Req() req, @Param('mangaId') mangaId: string) {
    return this.favoritesService.toggle(req.user.id, mangaId);
  }

  @Get('check/:mangaId')
  @UseGuards(JwtAuthGuard)
  async checkFavorite(@Req() req, @Param('mangaId') mangaId: string) {
    return this.favoritesService.check(req.user.id, mangaId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getFavorites(@Req() req) {
    return this.favoritesService.getUserFavorites(req.user.id);
  }
}
