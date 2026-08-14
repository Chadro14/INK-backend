// src/modules/security/security.controller.ts
import { Controller, Post, Body, Get, Param, BadRequestException } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
  constructor(private securityService: SecurityService) {}

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email requis');
    }
    return this.securityService.requestPasswordReset(email);
  }

  @Get('verify-reset-token/:token')
  async verifyToken(@Param('token') token: string) {
    return this.securityService.verifyResetToken(token);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }
    return this.securityService.resetPassword(token, newPassword);
  }
}
