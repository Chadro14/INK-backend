import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SteamService } from './steam.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('steam')
export class SteamController {
  constructor(private readonly steamService: SteamService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getSteam(@Req() req: any) {
    return this.steamService.getUserSteam(req.user.id);
  }
}