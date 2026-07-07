import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ManasService } from '../services/manas.service';

@Controller('manas')
export class ManasController {
  constructor(private readonly manasService: ManasService) {}

  // ============================================
  // OBTENIR LE SOLDE DE MANAS
  // ============================================
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req) {
    return this.manasService.getBalance(req.user.id);
  }

  // ============================================
  // CONSOMMER UN MANA
  // ============================================
  @Post('consume')
  @UseGuards(JwtAuthGuard)
  async consumeMana(
    @Req() req,
    @Body() body: { animeId: string; episodeNumber: number },
  ) {
    return this.manasService.consumeMana(
      req.user.id,
      body.animeId,
      body.episodeNumber,
    );
  }
}