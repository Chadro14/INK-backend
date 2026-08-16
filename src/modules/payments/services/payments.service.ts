// src/modules/payments/services/payments.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentType, PaymentStatus, PremiumPlan } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrangeMoneyService } from './orange-money.service';
import { MpesaService } from './mpesa.service';
import { InitiatePaymentDto, PaymentOperator } from '../dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private orangeMoneyService: OrangeMoneyService,
    private mpesaService: MpesaService,
  ) {}

  // ============================================
  // INITIER UN PAIEMENT
  // ============================================
  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const transactionId = `INK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // ✅ CORRECTION : Convertir le plan en PremiumPlan
    let planValue: PremiumPlan | undefined;
    if (dto.plan === 'yearly' || dto.plan === 'YEARLY') {
      planValue = PremiumPlan.YEARLY;
    } else if (dto.plan === 'monthly' || dto.plan === 'MONTHLY' || dto.plan) {
      planValue = PremiumPlan.MONTHLY;
    }

    // ✅ CRÉER LE PAIEMENT
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        transactionId,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        type: dto.type as PaymentType,
        status: PaymentStatus.PENDING,
        mangaId: dto.mangaId,
        chapterNumber: dto.chapterNumber,
        mobileNumber: dto.phoneNumber,
        plan: planValue, // ✅ CORRIGÉ
        metadata: {
          operator: dto.operator,
          description: dto.description || `Paiement ${dto.type}`,
        },
      },
    });

    // ✅ MODE TEST
    if (dto.operator === PaymentOperator.TEST) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS, completedAt: new Date() },
      });
      await this.activatePremium(userId, planValue || PremiumPlan.MONTHLY);

      return {
        success: true,
        paymentId: payment.id,
        transactionId,
        status: 'SUCCESS',
        message: 'Paiement test réussi (mode développement)',
        test: true,
      };
    }

    let result;
    try {
      if (dto.operator === PaymentOperator.ORANGE) {
        result = await this.orangeMoneyService.initiatePayment({
          amount: dto.amount,
          currency: dto.currency || 'USD',
          phoneNumber: dto.phoneNumber,
          description: dto.description || `INKDROP - ${dto.type}`,
          transactionId,
        });
      } else if (dto.operator === PaymentOperator.MPESA) {
        result = await this.mpesaService.initiatePayment({
          amount: dto.amount,
          currency: dto.currency || 'USD',
          phoneNumber: dto.phoneNumber,
          description: dto.description || `INKDROP - ${dto.type}`,
          transactionId,
        });
      } else {
        throw new BadRequestException('Opérateur non supporté');
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: result.transactionId,
          metadata: {
            ...(payment.metadata as Record<string, any> ?? {}),
            providerTransactionId: result.transactionId,
          },
        },
      });

      return {
        success: true,
        paymentId: payment.id,
        transactionId: result.transactionId,
        status: result.status,
        message: 'Demande de paiement envoyée. Veuillez confirmer sur votre téléphone.',
      };
    } catch (error) {
      console.error('❌ Erreur de paiement:', error.message);

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      return {
        success: false,
        paymentId: payment.id,
        transactionId,
        status: 'FAILED',
        message: error.message || 'Le paiement a échoué. Veuillez réessayer.',
      };
    }
  }

  // ============================================
  // ACTIVER L'ABONNEMENT PREMIUM
  // ============================================
  private async activatePremium(userId: string, plan: PremiumPlan = PremiumPlan.MONTHLY) {
    const duration = plan === PremiumPlan.YEARLY ? 365 : 30;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumExpires: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
        premiumPlan: plan,
      },
    });

    console.log(`✅ Abonnement Premium activé pour l'utilisateur ${userId}`);
  }

  // ... le reste du code (processSuccessfulPayment, confirmManualPayment, etc.)
}
