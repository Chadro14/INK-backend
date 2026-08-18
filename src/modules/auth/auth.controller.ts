// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService, // ✅ AJOUTER
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.getUserById(req.user.id);
  }

  // ✅ ENDPOINT POUR DÉBLOQUER
  @Post('unlock')
  async unlockAccount(@Body('email') email: string) {
    if (!email) {
      return { success: false, message: 'Email requis' };
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        isLocked: false,
        failedLoginAttempts: 0,
        role: 'ADMIN',
      },
    });

    return {
      success: true,
      message: `✅ Compte ${user.email} débloqué !`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isLocked: user.isLocked,
      },
    };
  }
}
