import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ============================================
  // RÉCUPÉRER L'UTILISATEUR CONNECTÉ (PROFIL)
  // ============================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.usersService.findById(req.user.id);
    return user;
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR ID
  // ============================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // ============================================
  // METTRE À JOUR UN UTILISATEUR
  // ============================================
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    // Vérifier que l'utilisateur modifie son propre profil
    if (req.user.id !== id) {
      throw new Error('Vous ne pouvez pas modifier le profil d\'un autre utilisateur');
    }
    return this.usersService.update(id, body);
  }

  // ============================================
  // SUPPRIMER UN UTILISATEUR
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    if (req.user.id !== id) {
      throw new Error('Vous ne pouvez pas supprimer le compte d\'un autre utilisateur');
    }
    return this.usersService.delete(id);
  }
}