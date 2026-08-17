// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
  ) {
    // ✅ Utilisation de @Ip() pour récupérer l'IP
    return this.authService.login(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.getUserById(req.user.id);
  }
}
