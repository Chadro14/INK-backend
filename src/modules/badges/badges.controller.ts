import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BadgesService } from './badges.service';
import { BadgeAwardService } from './badge-award.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('badges')
export class BadgesController {
  constructor(
    private badgesService: BadgesService,
    private badgeAwardService: BadgeAwardService,
  ) {}

  // ============================================
  // RÉCUPÉRER TOUS LES BADGES
  // ============================================
  @Get()
  async getAllBadges() {
    const badges = await this.badgesService.getAllBadges();
    return { success: true, data: badges };
  }

  // ============================================
  // RÉCUPÉRER LES BADGES D'UN UTILISATEUR
  // ============================================
  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUserBadges(@Req() req: any) {
    const badges = await this.badgesService.getUserBadges(req.user.id);
    return { success: true, data: badges };
  }

  // ============================================
  // RÉCUPÉRER LES BADGES AFFICHÉS D'UN UTILISATEUR
  // ============================================
  @Get('user/displayed')
  @UseGuards(JwtAuthGuard)
  async getDisplayedBadges(@Req() req: any) {
    const badges = await this.badgesService.getDisplayedBadges(req.user.id);
    return { success: true, data: badges };
  }

  // ============================================
  // VÉRIFIER SI UN UTILISATEUR A UN BADGE
  // ============================================
  @Get('has/:slug')
  @UseGuards(JwtAuthGuard)
  async hasBadge(@Req() req: any, @Param('slug') slug: string) {
    const has = await this.badgesService.hasBadge(req.user.id, slug);
    return { success: true, data: { has } };
  }

  // ============================================
  // AFFICHER/CACHER UN BADGE
  // ============================================
  @Put('display/:userBadgeId')
  @UseGuards(JwtAuthGuard)
  async toggleBadgeDisplay(@Req() req: any, @Param('userBadgeId') userBadgeId: string) {
    const result = await this.badgesService.toggleBadgeDisplay(req.user.id, userBadgeId);
    return { success: true, data: result };
  }

  // ============================================
  // ADMIN : CRÉER UN BADGE
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createBadge(@Body() data: any) {
    const badge = await this.badgesService.createBadge(data);
    return { success: true, data: badge };
  }

  // ============================================
  // ADMIN : SEED LES BADGES PAR DÉFAUT
  // ============================================
  @Post('seed')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async seedBadges() {
    const result = await this.badgeAwardService.seedDefaultBadges();
    return { success: true, ...result };
  }

  // ============================================
  // ADMIN : SUPPRIMER UN BADGE
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteBadge(@Param('id') id: string) {
    const result = await this.badgesService.deleteBadge(id);
    return { success: true, ...result };
  }
}
