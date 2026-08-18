// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ AJOUTÉ

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService, // ✅ AJOUTÉ
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
  ) {
    return this.authService.login(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.getUserById(req.user.id);
  }

  // ============================================
  // ✅ ENDPOINT TEMPORAIRE POUR DÉBLOQUER LE COMPTE
  // ============================================
  @Post('unlock')
  async unlockAccount(@Body('email') email: string) {
    if (!email) {
      return {
        success: false,
        message: 'Email requis',
      };
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        isLocked: false,
        failedLoginAttempts: 0,
        role: 'ADMIN', // ✅ En bonus, tu deviens ADMIN
      },
    });

    return {
      success: true,
      message: `✅ Compte ${user.email} débloqué et promu ADMIN !`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isLocked: user.isLocked,
        failedLoginAttempts: user.failedLoginAttempts,
      },
    };
  }
}
