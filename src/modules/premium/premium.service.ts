// src/modules/premium/premium.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PremiumService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // ACTIVER LE PREMIUM
  // ✅ Standard = 30 jours | Pro = 60 jours | Premium = 90 jours
  // ============================================
  async activatePremium(userId: string, plan: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // ✅ Durées selon les nouveaux plans
    const durations: Record<string, number> = {
      standard: 30,   // 1 mois
      pro: 60,        // 2 mois
      premium: 90,    // 3 mois
      monthly: 30,    // legacy
      yearly: 365,    // legacy
    };

    const normalizedPlan = plan.toLowerCase();
    const days = durations[normalizedPlan] || 30;

    // ✅ Cumul : si le user a déjà un Premium actif, on étend
    let baseDate = new Date();
    if (
      user.premiumActive &&
      user.premiumExpires &&
      new Date(user.premiumExpires) > new Date()
    ) {
      baseDate = new Date(user.premiumExpires);
    }

    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + days);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumPlan: this.mapPlanToEnum(normalizedPlan),
        premiumExpires: expiresAt,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'PREMIUM_EXPIRY',
        title: `🎉 Abonnement ${plan} activé !`,
        body: `Votre abonnement ${plan} est actif pour ${days} jours. Profitez de tous les avantages !`,
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
          data: { premiumActive: false },
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
  // ✅ Mis à jour avec les nouvelles fonctionnalités
  // ============================================
  getPlanBenefits(plan: string) {
    const benefits = {
      standard: {
        name: 'Standard',
        price: 3,
        currency: 'USD',
        duration: '1 mois (30 jours)',
        features: [
          'Tickets illimités pendant 1 mois',
          'Accès illimité aux chapitres payants',
          'Badge Standard (bleu)',
          'QR Code avec couleurs Premium',
        ],
      },
      pro: {
        name: 'Pro',
        price: 5,
        currency: 'USD',
        duration: '2 mois (60 jours)',
        features: [
          'Tout ce qui est dans Standard',
          'Collaboration avec un dessinateur (chat gratuit)',
          'Compte certifié',
          '4 premiers mangas publiés épinglés (publicité)',
          'Connecter 1 personne à votre abonnement',
          'Badge Pro (violet)',
        ],
      },
      premium: {
        name: 'Premium',
        price: 7,
        currency: 'USD',
        duration: '3 mois (90 jours)',
        features: [
          'Tout ce qui est dans Standard et Pro',
          '5 mangas épinglés avec publicité',
          '3 comptes ajoutés pour certification',
          'Créer votre propre événement (10 participants)',
          'Droit de participation : 50 MANAS',
          'Accès XELIRA IA (compréhension + revenus)',
          'Badge Premium (or)',
          'Badge "Meilleur Fan" à donner aux lecteurs',
        ],
      },
    };

    const normalizedPlan = plan.toLowerCase();
    return benefits[normalizedPlan as keyof typeof benefits] || null;
  }

  // ============================================
  // HELPER : MAP PLAN TO ENUM
  // ✅ Mis à jour pour les nouveaux plans
  // ============================================
  private mapPlanToEnum(plan: string) {
    const map: Record<string, any> = {
      standard: 'STANDARD',
      pro: 'PRO',
      premium: 'PREMIUM',
      monthly: 'MONTHLY', // legacy
      yearly: 'YEARLY', // legacy
    };
    return map[plan] || 'STANDARD';
  }
}
