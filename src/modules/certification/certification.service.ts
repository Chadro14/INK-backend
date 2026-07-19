import { Injectable, NotFoundException } from '@nestjs/common';
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
  // VÉRIFICATION AUTOMATIQUE (Cron job)
  // ============================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCertifyUsers() {
    console.log('🔄 Vérification des certifications...');

    // Récupérer tous les créateurs qui ne sont pas encore certifiés
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

      // Seuils pour la certification
      const hasEnoughChapters = totalChapters >= 10;
      const hasEnoughFollowers = followersCount >= 50;
      const isOldEnough = creator.createdAt
        ? new Date(creator.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : false;

      if (hasEnoughChapters && hasEnoughFollowers && isOldEnough) {
        await this.prisma.user.update({
          where: { id: creator.id },
          data: {
            isCertified: true,
            certifiedAt: new Date(),
          },
        });

        // Notification
        await this.prisma.notification.create({
          data: {
            userId: creator.id,
            type: 'CERTIFICATION',
            title: '🎉 Félicitations !',
            body: 'Vous êtes maintenant certifié ⭐',
            metadata: { badge: 'gold' },
          },
        });
      }
    }

    console.log('✅ Certification terminée');
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
      throw new Error('Vous devez être certifié pour changer la couleur du badge');
    }

    if (!BADGE_COLORS[color]) {
      throw new Error('Couleur invalide');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarColor: color },
    });
  }

  // ============================================
  // OBTENIR LE STATUT DE CERTIFICATION
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
        required: 10,
        met: totalChapters >= 10,
      },
      followers: {
        current: followersCount,
        required: 50,
        met: followersCount >= 50,
      },
      age: {
        current: user.createdAt
          ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        required: 30,
        met: user.createdAt
          ? new Date(user.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
  // LISTE DES COULEURS DISPONIBLES
  // ============================================
  getAvailableColors() {
    return Object.keys(BADGE_COLORS).map((key) => ({
      name: key,
      value: BADGE_COLORS[key],
    }));
  }
}