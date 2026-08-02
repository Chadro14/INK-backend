import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowService } from '../follow/follow.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export const BADGE_COLORS = {
  gold: '#FFD700',
  rose: '#FF6B9D',
  rouge: '#FF1744',
  vert: '#00E676',
  bleu: '#2979FF',
  violet: '#7C4DFF',
  orange: '#FF9100',
  turquoise: '#00BCD4',
  magenta: '#E040FB',
  argent: '#B0BEC5',
  bronze: '#CD7F32',
  blanc: '#FFFFFF',
  noir: '#212121',
  gold_gradient: 'linear-gradient(135deg, #FFD700, #FF8F00)',
  rose_gradient: 'linear-gradient(135deg, #FF6B9D, #FF4081)',
  rouge_gradient: 'linear-gradient(135deg, #FF1744, #D50000)',
  vert_gradient: 'linear-gradient(135deg, #00E676, #00C853)',
  bleu_gradient: 'linear-gradient(135deg, #2979FF, #0D47A1)',
  violet_gradient: 'linear-gradient(135deg, #7C4DFF, #311B92)',
  sunset: 'linear-gradient(135deg, #FF6B35, #F03E5B)',
  ocean: 'linear-gradient(135deg, #00D4FF, #6B46FF)',
  forest: 'linear-gradient(135deg, #10B981, #047857)',
  fire: 'linear-gradient(135deg, #FF6B35, #FFE66D)',
};

@Injectable()
export class CertificationService {
  constructor(
    private prisma: PrismaService,
    private followService: FollowService,
  ) {}

  // ============================================
  // CERTIFICATION AUTOMATIQUE
  // ============================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCertifyUsers() {
    console.log('🔄 Vérification des certifications...');

    const creators = await this.prisma.user.findMany({
      where: {
        role: 'CREATOR',
        isCertified: false,
      },
      include: {
        mangas: {
          include: {
            chapters: true,
          },
        },
      },
    });

    for (const creator of creators) {
      const totalChapters = creator.mangas.reduce(
        (sum, manga) => sum + manga.chapters.length,
        0,
      );

      const { followersCount } = await this.followService.getFollowCounts(creator.id);

      const hasEnoughChapters = totalChapters >= 40;
      const hasEnoughFollowers = followersCount >= 350;
      const isOldEnough = creator.createdAt
        ? new Date(creator.createdAt) < new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000)
        : false;

      if (hasEnoughChapters && hasEnoughFollowers && isOldEnough) {
        await this.prisma.user.update({
          where: { id: creator.id },
          data: {
            isCertified: true,
            certifiedAt: new Date(),
          },
        });

        await this.prisma.notification.create({
          data: {
            userId: creator.id,
            type: 'CERTIFICATION',
            title: 'Félicitations',
            body: 'Vous êtes maintenant certifié sur INKDROP',
            metadata: { badge: 'gold' },
          },
        });

        console.log(`✅ Utilisateur ${creator.username} certifié !`);
      }
    }

    console.log('✅ Vérification des certifications terminée');
  }

  // ============================================
  // CERTIFIER UN UTILISATEUR (MANUEL)
  // ============================================
  async certifyUser(adminId: string, userId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.isCertified) {
      throw new BadRequestException('Cet utilisateur est déjà certifié');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isCertified: true,
        certifiedAt: new Date(),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: userId,
        type: 'CERTIFICATION',
        title: 'Félicitations',
        body: 'Vous avez été certifié par l\'équipe INKDROP',
        metadata: { badge: 'gold' },
      },
    });

    return {
      success: true,
      message: 'Utilisateur certifié avec succès',
      user: updatedUser,
    };
  }

  // ============================================
  // CHANGER LA COULEUR DU BADGE
  // ============================================
  async updateBadgeColor(userId: string, color: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.isCertified) {
      throw new ForbiddenException('Vous devez être certifié pour changer la couleur du badge');
    }

    const normalizedColor = color ? color.toLowerCase().trim() : '';

    if (!BADGE_COLORS[normalizedColor]) {
      throw new BadRequestException('Couleur invalide');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarColor: normalizedColor },
    });
  }

  // ============================================
  // STATUT DE CERTIFICATION
  // ============================================
  async getCertificationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        mangas: {
          include: {
            chapters: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const totalChapters = user.mangas.reduce(
      (sum, manga) => sum + manga.chapters.length,
      0,
    );

    const { followersCount } = await this.followService.getFollowCounts(userId);

    const conditions = {
      chapters: {
        current: totalChapters,
        required: 40,
        met: totalChapters >= 40,
      },
      followers: {
        current: followersCount,
        required: 350,
        met: followersCount >= 350,
      },
      age: {
        current: user.createdAt
          ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        required: 150,
        met: user.createdAt
          ? new Date(user.createdAt) < new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000)
          : false,
      },
    };

    const canCertify = conditions.chapters.met && conditions.followers.met && conditions.age.met;

    return {
      isCertified: user.isCertified,
      certifiedAt: user.certifiedAt,
      badgeColor: user.avatarColor || 'gold',
      conditions,
      canCertify,
    };
  }

  // ============================================
  // LISTE DES COULEURS
  // ============================================
  getAvailableColors() {
    return Object.keys(BADGE_COLORS).map((key) => ({
      name: key,
      value: BADGE_COLORS[key],
    }));
  }
}
