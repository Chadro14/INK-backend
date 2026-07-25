import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException, // ✅ Ajouté ici
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ============================================
  // RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
  // ============================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const user = await this.usersService.findById(req.user.id);
    delete user.passwordHash;
    return user;
  }

  // ============================================
  // METTRE À JOUR LE PROFIL
  // ============================================
  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: any, @Body() body: any) {
    const { username, email, bio } = body;
    const user = await this.usersService.update(req.user.id, {
      username,
      email,
      bio,
    });
    delete user.passwordHash;
    return user;
  }

  // ============================================
  // UPLOADER UN AVATAR
  // ============================================
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('L\'image ne doit pas dépasser 5MB');
    }

    const avatarUrl = await this.usersService.uploadAvatar(req.user.id, file);
    return { avatarUrl };
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR USERNAME
  // ============================================
  @Get('username/:username')
  async findByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    if (user.passwordHash) {
      delete user.passwordHash;
    }
    return user;
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR ID
  // ============================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
