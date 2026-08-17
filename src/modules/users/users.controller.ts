import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsOptional } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from '../../common/services/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import sharp from 'sharp';

export class UpdateBadgeColorDto {
  @IsString({ message: 'La couleur du badge doit être une chaîne de caractères' })
  @IsOptional()
  badgeColor?: string;

  @IsString()
  @IsOptional()
  avatarColor?: string;
}

@Controller('users')
export class UsersController {
  private readonly AVAILABLE_COLORS = [
    '#3B82F6',
    '#EC4899',
    '#10B981',
    '#EF4444',
    '#FFD700',
    '#8B5CF6',
    '#F97316',
    '#111827',
    '#00FF66',
    '#A5F3FC',
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
    if (user && (user as any).passwordHash) {
      delete (user as any).passwordHash;
    }
    return user;
  }

  // ============================================
  // RÉCUPÉRER LES CRÉATEURS CERTIFIÉS (TOP)
  // ============================================
  @Get('top-creators')
  @UseGuards(JwtAuthGuard)
  async getTopCreators(@Query('limit') limit: string = '6') {
    const creators = await this.usersService.getTopCreators(parseInt(limit));
    return { success: true, data: creators };
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
    if (user && (user as any).passwordHash) {
      delete (user as any).passwordHash;
    }
    return user;
  }

  // ============================================
  // METTRE À JOUR LA COULEUR DU BADGE
  // ============================================
  @Patch('badge-color')
  @Put('badge-color')
  @UseGuards(JwtAuthGuard)
  async updateBadgeColor(@Req() req: any, @Body() dto: UpdateBadgeColorDto) {
    const userId = req.user?.id || req.user?.sub;
    const selectedColor = dto.badgeColor || dto.avatarColor;

    if (!selectedColor) {
      throw new BadRequestException('La couleur est requise.');
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (!user.isCertified) {
      throw new BadRequestException(
        'Seuls les utilisateurs certifiés peuvent modifier la couleur de leur badge',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { badgeColor: selectedColor },
    });

    if (updatedUser && (updatedUser as any).passwordHash) {
      delete (updatedUser as any).passwordHash;
    }
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

    const user = await this.usersService.findById(userId);
    if (user && user.avatarUrl) {
      try {
        const oldKey = user.avatarUrl.split('/').pop();
        if (oldKey) {
          await this.storage.delete(`user/${userId}/${oldKey}`, 'chapters');
        }
      } catch (error) {
        console.log('Suppression ancien avatar échouée:', error.message);
      }
    }

    const compressedBuffer = await sharp(file.buffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `user/${userId}/avatar-${Date.now()}.webp`;

    await this.storage.upload(key, compressedBuffer, 'image/webp', 'chapters');

    const publicUrl = this.storage.getPublicUrl(key, 'chapters');

    await this.usersService.updateAvatar(userId, publicUrl);

    return {
      avatarUrl: publicUrl,
      message: 'Avatar mis à jour avec succès',
    };
  }

  // ============================================
  // SUPPRIMER L'AVATAR
  // ============================================
  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;

    const user = await this.usersService.findById(userId);
    if (!user || !user.avatarUrl) {
      throw new BadRequestException('Aucun avatar à supprimer');
    }

    const oldKey = user.avatarUrl.split('/').pop();
    if (oldKey) {
      await this.storage.delete(`user/${userId}/${oldKey}`, 'chapters');
    }

    await this.usersService.updateAvatar(userId, null);

    return { message: 'Avatar supprimé avec succès' };
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

  // ============================================
  // SAUVEGARDER L'ÉTAT
  // ============================================
  @Post('state')
  @UseGuards(JwtAuthGuard)
  async saveState(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.usersService.saveState(userId, body);
    return { success: true };
  }

  @Get('state')
  @UseGuards(JwtAuthGuard)
  async loadState(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const state = await this.usersService.loadState(userId);
    return { data: state };
  }

  // ============================================
  // ✅ CHANGER LE MOT DE PASSE
  // ============================================
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.usersService.changePassword(userId, currentPassword, newPassword);
  }

  // ============================================
  // ✅ CHANGER L'EMAIL (Étape 1 : Demande)
  // ============================================
  @Post('request-email-change')
  @UseGuards(JwtAuthGuard)
  async requestEmailChange(
    @Req() req: any,
    @Body('newEmail') newEmail: string,
    @Body('password') password: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.usersService.requestEmailChange(userId, newEmail, password);
  }

  // ============================================
  // ✅ CHANGER L'EMAIL (Étape 2 : Confirmation)
  // ============================================
  @Post('confirm-email-change')
  async confirmEmailChange(@Body('token') token: string) {
    return this.usersService.confirmEmailChange(token);
  }

  // ============================================
  // ✅ METTRE À JOUR LES NOTIFICATIONS
  // ============================================
  @Put('notifications')
  @UseGuards(JwtAuthGuard)
  async updateNotifications(
    @Req() req: any,
    @Body() settings: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.usersService.updateNotificationSettings(userId, settings);
  }

  // ============================================
  // ✅ METTRE À JOUR LES PRÉFÉRENCES
  // ============================================
  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Req() req: any,
    @Body() preferences: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.usersService.updatePreferences(userId, preferences);
  }

  // ============================================
  // ✅ SUPPRIMER LE COMPTE
  // ============================================
  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() req: any,
    @Body('password') password: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.usersService.deleteAccount(userId, password);
  }
}
