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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from '../../common/services/storage.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('users')
export class UsersController {
  // Liste des 4 couleurs gratuites (Shonen de base)
  private readonly FREE_COLORS = [
    '#3B82F6', // Bleu Électrique
    '#EC4899', // Rose Magique
    '#10B981', // Vert Émeraude
    '#EF4444', // Rouge Feu
  ];

  // Liste des couleurs & effets Premium / Animés
  private readonly PREMIUM_COLORS = [
    '#FFD700', // Or Royal / Super Saiyan
    '#8B5CF6', // Violet Gojo / Domain
    '#F97316', // Orange Foudre / Hokage
    '#111827', // Obsidian Dark / Berserk
    '#2E1065', // Espace / Void Purple
    '#00FF66', // Cyber Matrix Green
    '#F8FAFC', // Éclair Blanc / Lightning
    '#881337', // Sang Maudit / Blood Moon
    '#A5F3FC', // Glace Éternelle / Frost
    'gradient-rainbow', // Arc-en-ciel animé
    'gradient-fire', // Flamme animée
    'holo-shimmer', // Effet Holographique
    'mana-pulse', // Pulsation de Mana
    'solar-eclipse', // Éclipse Solaire
    'supernova', // Supernova
    'divine-platinum', // Platine Pur
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
    const user = await this.usersService.findById(req.user.id);
    delete (user as any).passwordHash;
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
    delete (user as any).passwordHash;
    return user;
  }

  // ============================================
  // METTRE À JOUR LA COULEUR DU BADGE (AVEC VÉRIFICATION PREMIUM)
  // ============================================
  @Put('badge-color')
  @UseGuards(JwtAuthGuard)
  async updateBadgeColor(@Req() req: any, @Body() body: { badgeColor: string }) {
    const { badgeColor } = body;

    if (!badgeColor) {
      throw new BadRequestException("La couleur ou l'effet du badge est requis");
    }

    const user = await this.usersService.findById(req.user.id);

    if (!user.isCertified) {
      throw new BadRequestException(
        'Seuls les utilisateurs certifiés peuvent modifier la couleur de leur badge',
      );
    }

    const isFreeColor = this.FREE_COLORS.includes(badgeColor);
    const isPremiumColor = this.PREMIUM_COLORS.includes(badgeColor);

    if (!isFreeColor && !isPremiumColor) {
      throw new BadRequestException('Style de badge inconnu ou non autorisé.');
    }

    if (isPremiumColor && !user.premiumActive) {
      throw new BadRequestException(
        'Ce style de badge scintillant ou animé est réservé aux membres Premium !',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: req.user.id },
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
  async getAvailableBadgeColors(@Req() req: any) {
    const user = await this.usersService.findById(req.user.id);

    return {
      freeColors: this.FREE_COLORS,
      premiumColors: user.premiumActive ? this.PREMIUM_COLORS : [],
      isUserPremium: user.premiumActive,
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

    const key = `user/${req.user.id}/avatar-${Date.now()}.webp`;
    await this.storage.upload(key, file.buffer, file.mimetype, 'avatars');

    const avatarUrl = await this.storage.getSignedUrl(key, 86400, 'avatars');
    await this.usersService.updateAvatar(req.user.id, avatarUrl);

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
