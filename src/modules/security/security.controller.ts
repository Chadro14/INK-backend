// src/modules/security/security.controller.ts
import { Controller, Post, Body, Get, Param, BadRequestException, Req, Ip } from '@nestjs/common';
import { SecurityService } from './security.service';
import { Request } from 'express';

@Controller('security')
export class SecurityController {
  constructor(private securityService: SecurityService) {}

  // ============================================
  // 1. DEMANDER LA RÉINITIALISATION
  // ============================================
  @Post('forgot-password')
  async forgotPassword(
    @Body('email') email: string,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    if (!email) {
      throw new BadRequestException('Email requis');
    }

    const userAgent = req.headers['user-agent'] || 'unknown';

    return this.securityService.requestPasswordReset(email, ip, userAgent);
  }

  // ============================================
  // 2. VÉRIFIER LE TOKEN
  // ============================================
  @Get('verify-reset-token/:token')
  async verifyToken(
    @Param('token') token: string,
    @Ip() ip: string,
  ) {
    if (!token) {
      throw new BadRequestException('Token requis');
    }
    return this.securityService.verifyResetToken(token, ip);
  }

  // ============================================
  // 3. RÉINITIALISER LE MOT DE PASSE
  // ============================================
  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Ip() ip: string,
  ) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }
    return this.securityService.resetPassword(token, newPassword, ip);
  }
}
