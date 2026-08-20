// src/modules/premium/premium.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
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

    // Définir la durée selon le plan
    const durations = {
      standard: 30,
      premium: 30,
      pro: 30,
    };

    const days = durations[plan as keyof typeof durations] || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Mettre à jour l'utilisateur
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumPlan: this.mapPlanToEnum(plan),
        premiumExpires: expiresAt,
      },
    });

    // Créer une notification
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
      // Mettre à jour en base
      await this.prisma.user.update({
        where: { id: userId },
        data: { premiumActive: false },
      });
      return false;
    }

    return true;
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
