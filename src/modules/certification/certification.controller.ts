import { Controller, Get, Post, Body, UseGuards, Req, Param } from '@nestjs/common';
import { CertificationService } from './certification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@Controller('certification')
export class CertificationController {
  constructor(private readonly certificationService: CertificationService) {}

  // ============================================
  // STATUT DE CERTIFICATION
  // ============================================
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    return this.certificationService.getCertificationStatus(req.user.id);
  }

  // ============================================
  // CHANGER LA COULEUR DU BADGE
  // ============================================
  @Post('badge-color')
  @UseGuards(JwtAuthGuard)
  async updateBadgeColor(@Req() req: any, @Body() dto: UpdateCertificationDto) {
    return this.certificationService.updateBadgeColor(req.user.id, dto.badgeColor);
  }

  // ============================================
  // LISTE DES COULEURS DISPONIBLES
  // ============================================
  @Get('colors')
  getColors() {
    return this.certificationService.getAvailableColors();
  }

  // ============================================
  // CERTIFIER MANUELLEMENT (admin uniquement)
  // ============================================
  @Post('certify/:userId')
  @UseGuards(JwtAuthGuard)
  async certifyUser(@Req() req: any, @Param('userId') userId: string) {
    return this.certificationService.certifyUser(req.user.id, userId);
  }

  // ============================================
  // STATUT D'UN UTILISATEUR SPÉCIFIQUE (public)
  // ============================================
  @Get(':userId/status')
  async getUserStatus(@Param('userId') userId: string) {
    return this.certificationService.getCertificationStatus(userId);
  }
}