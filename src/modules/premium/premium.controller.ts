// src/modules/premium/premium.controller.ts
import { Controller, Post, Get, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PremiumService } from './premium.service';

@Controller('premium')
export class PremiumController {
  constructor(
    private premiumService: PremiumService,
    private prisma: PrismaService,
  ) {}

  // ============================================
  // 1. RÉCUPÉRER LE STATUT PREMIUM DE L'UTILISATEUR
  // ============================================
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        premiumActive: true,
        premiumPlan: true,
        premiumExpires: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Vérifier si le premium a expiré
    let isActive = user.premiumActive;
    if (user.premiumExpires && new Date(user.premiumExpires) < new Date()) {
      isActive = false;
      // Mettre à jour en base
      await this.prisma.user.update({
        where: { id: userId },
        data: { premiumActive: false },
      });
    }

    return {
      premiumActive: isActive,
      premiumPlan: user.premiumPlan,
      premiumExpires: user.premiumExpires,
    };
  }

  // ============================================
  // 2. SOUSCRIRE À UN ABONNEMENT
  // ============================================
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Req() req: any,
    @Body() body: { plan: 'standard' | 'premium' | 'pro'; paymentMethod: 'mobile_money' | 'card' }
  ) {
    const userId = req.user?.id || req.user?.sub;
    const { plan, paymentMethod } = body;

    if (!plan || !paymentMethod) {
      throw new BadRequestException('Plan et méthode de paiement requis');
    }

    // Définir le prix selon le plan
    const prices = {
      standard: 3,
      premium: 5,
      pro: 7,
    };

    const amount = prices[plan as keyof typeof prices];
    if (!amount) {
      throw new BadRequestException('Plan invalide');
    }

    // 1. Créer un paiement en attente
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount,
        currency: 'USD',
        type: 'PREMIUM',
        status: 'PENDING',
        plan: this.mapPlanToEnum(plan),
        metadata: {
          plan,
          paymentMethod,
        },
      },
    });

    // 2. Appeler le service de paiement (Orange Money, M-Pesa, etc.)
    // Pour l'instant, on simule un paiement réussi

    // 3. Simuler le paiement réussi
    await this.premiumService.activatePremium(userId, plan);

    // 4. Mettre à jour le paiement
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Abonnement ${plan} activé avec succès !`,
      plan,
      amount,
    };
  }

  // ============================================
  // 3. ANNULER L'ABONNEMENT
  // ============================================
  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: false,
        premiumExpires: new Date(),
      },
    });

    return {
      success: true,
      message: 'Abonnement annulé. Vous pourrez profiter de vos avantages jusqu\'à la fin de la période en cours.',
    };
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
