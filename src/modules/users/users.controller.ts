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
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsNotEmpty } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from '../../common/services/storage.service';
import { PrismaService } from '../../prisma/prisma.service';

// DTO pour valider le body avec le ValidationPipe de NestJS
export class UpdateBadgeColorDto {
  @IsString({ message: 'La couleur du badge doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La couleur ou l\'effet du badge est requis' })
  badgeColor: string;
}

@Controller('users')
export class UsersController {
  // Liste unique de toutes les couleurs & effets disponibles
  private readonly AVAILABLE_COLORS = [
    '#3B82F6', // Bleu Électrique
    '#EC4899', // Rose Magique
    '#10B981', // Vert Émeraude
    '#EF4444', // Rouge Feu
    '#FFD700', // Or Royal
    '#8B5CF6', // Violet
    '#F97316', // Orange
    '#111827', // Obsidian Dark
    '#00FF66', // Cyber Green
    '#A5F3FC', // Glace Éternelle
    'gradient-rainbow',
    'gradient-fire',
    'holo-shimmer',
    'mana-pulse',
  ];

  constructor(
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
  // ============================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const user = await this.usersService.findById(userId);
    delete (user as any).passwordHash;
    return user;
  }

  // ============================================
  // METTRE À JOUR LE PROFIL
  // ============================================
  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || req.user?.sub;
    const { username, email, bio } = body;
    const user = await this.usersService.update(userId, {
      username,
      email,
      bio,
    });
    delete (user as any).passwordHash;
    return user;
  }

  // ============================================
  // METTRE À JOUR LA COULEUR DU BADGE (CORRIGÉ)
  // ============================================
  @Put('badge-color')
  @UseGuards(JwtAuthGuard)
  async updateBadgeColor(@Req() req: any, @Body() dto: UpdateBadgeColorDto) {
    const userId = req.user?.id || req.user?.sub;
    const { badgeColor } = dto;

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (!user.isCertified) {
      throw new BadRequestException(
        'Seuls les utilisateurs certifiés peuvent modifier la couleur de leur badge',
      );
    }

    // Met à jour la couleur du badge
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { badgeColor },
    });

    delete (updatedUser as any).passwordHash;
    return updatedUser;
  }

  // ============================================
  // RÉCUPÉRER LA LISTE DES COULEURS DISPONIBLES
  // ============================================
  @Get('badge-colors/list')
  @UseGuards(JwtAuthGuard)
  async getAvailableBadgeColors() {
    return {
      colors: this.AVAILABLE_COLORS,
    };
  }

  // ============================================
  // ACCORDER / RETIRER LA CERTIFICATION (ADMIN)
  // ============================================
  @Put(':id/certify')
  @UseGuards(JwtAuthGuard)
  async setCertification(
    @Param('id') targetUserId: string,
    @Body('isCertified') isCertified: boolean,
  ) {
    return this.usersService.setCertification(targetUserId, isCertified);
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
      throw new BadRequestException("L'image ne doit pas dépasser 5MB");
    }

    const userId = req.user?.id || req.user?.sub;
    const key = `user/${userId}/avatar-${Date.now()}.webp`;
    await this.storage.upload(key, file.buffer, file.mimetype, 'avatars');

    const avatarUrl = await this.storage.getSignedUrl(key, 86400, 'avatars');
    await this.usersService.updateAvatar(userId, avatarUrl);

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
    if ((user as any).passwordHash) {
      delete (user as any).passwordHash;
    }
    return user;
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR ID
  // ============================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if ((user as any).passwordHash) {
      delete (user as any).passwordHash;
    }
    return user;
  }
}
