// src/modules/premium/premium.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'; // ✅ AJOUTÉ
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PremiumService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // ACTIVER LE PREMIUM
  // ============================================
  async activatePremium(userId: string, plan: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const durations = {
      standard: 30,
      premium: 30,
      pro: 30,
    };

    const days = durations[plan as keyof typeof durations] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumPlan: this.mapPlanToEnum(plan),
        premiumExpires: expiresAt,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'PREMIUM_EXPIRY',
        title: `🎉 Abonnement ${plan} activé !`,
        body: `Votre abonnement ${plan} est maintenant actif. Profitez de tous les avantages !`,
      },
    });

    return updatedUser;
  }

  // ============================================
  // VÉRIFIER SI LE PREMIUM EST ACTIF
  // ============================================
  async isPremiumActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        premiumActive: true,
        premiumExpires: true,
      },
    });

    if (!user) return false;
    if (!user.premiumActive) return false;
    if (user.premiumExpires && new Date(user.premiumExpires) < new Date()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { premiumActive: false },
      });
      return false;
    }

    return true;
  }

  // ============================================
  // ✅ CRON : VÉRIFIER LES ABONNEMENTS EXPIRÉS
  // ============================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredPremium() {
    console.log('🔄 Vérification des abonnements premium expirés...');

    try {
      const expiredUsers = await this.prisma.user.findMany({
        where: {
          premiumActive: true,
          premiumExpires: {
            lt: new Date(),
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          premiumExpires: true,
        },
      });

      if (expiredUsers.length === 0) {
        console.log('✅ Aucun abonnement expiré trouvé.');
        return;
      }

      console.log(`📊 ${expiredUsers.length} abonnement(s) expiré(s) trouvé(s).`);

      for (const user of expiredUsers) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            premiumActive: false,
          },
        });

        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'PREMIUM_EXPIRY',
            title: '⏰ Votre abonnement premium a expiré',
            body: 'Votre abonnement premium est arrivé à expiration. Profitez à nouveau de tous les avantages en vous réabonnant.',
            link: '/premium',
          },
        });

        console.log(`✅ Premium désactivé pour ${user.username} (${user.email})`);
      }

      console.log(`✅ ${expiredUsers.length} abonnement(s) expiré(s) désactivé(s).`);
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des abonnements expirés :', error);
    }
  }

  // ============================================
  // RÉCUPÉRER LES AVANTAGES DU PLAN
  // ============================================
  getPlanBenefits(plan: string) {
    const benefits = {
      standard: {
        name: 'Standard',
        price: 3,
        features: [
          'Notifications automatiques',
          'Accès illimité à tous les chapitres',
          'Sans publicité',
          'Badge Premium basique',
          'Commentaires prioritaires',
          '1 appareil',
        ],
      },
      premium: {
        name: 'Premium',
        price: 5,
        features: [
          'Notifications automatiques',
          'Accès illimité à tous les chapitres',
          'Sans publicité',
          'Accès anticipé (2 jours)',
          'Badge Premium personnalisable',
          'Commentaires prioritaires',
          '3 appareils',
          'Épinglage de manga (1 semaine)',
          'Statistiques avancées',
          'Planification de publication',
          'Upload en masse',
          'Badges personnalisés pour fans',
          'Concours et événements',
          'Contenu exclusif',
          'Support prioritaire',
          '50 MANAS bonus / mois',
          'Traduction XELIRA en temps réel',
        ],
      },
      pro: {
        name: 'Pro',
        price: 7,
        features: [
          'Notifications automatiques',
          'Accès illimité à tous les chapitres',
          'Sans publicité',
          'Accès anticipé (1 jour)',
          'Badge Pro personnalisable',
          'Commentaires prioritaires',
          '2 appareils',
          'Épinglage de manga (1 semaine)',
          'Statistiques avancées',
          'Planification de publication',
          'Upload en masse',
          'Badge Certifié',
        ],
      },
    };

    return benefits[plan as keyof typeof benefits] || null;
  }

  // ============================================
  // HELPER : MAP PLAN TO ENUM
  // ============================================
  private mapPlanToEnum(plan: string) {
    const map = {
      standard: 'MONTHLY',
      premium: 'MONTHLY',
      pro: 'MONTHLY',
    };
    return map[plan as keyof typeof map] as any;
  }
}
