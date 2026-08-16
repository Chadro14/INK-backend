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
  // 1. INITIER UN PAIEMENT
  // ============================================
  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const transactionId = `INK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let planValue: PremiumPlan | undefined;
    if (dto.plan === 'yearly' || dto.plan === 'YEARLY') {
      planValue = PremiumPlan.YEARLY;
    } else if (dto.plan === 'monthly' || dto.plan === 'MONTHLY' || dto.plan) {
      planValue = PremiumPlan.MONTHLY;
    }

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
        plan: planValue,
        metadata: {
          operator: dto.operator,
          description: dto.description || `Paiement ${dto.type}`,
        },
      },
    });

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
  // 2. TRAITER UN PAIEMENT RÉUSSI
  // ============================================
  async processSuccessfulPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    switch (payment.type) {
      case PaymentType.PREMIUM:
        await this.activatePremium(payment.userId, payment.plan || PremiumPlan.MONTHLY);
        break;
      case PaymentType.CHAPTER:
        if (payment.mangaId && payment.chapterNumber) {
          await this.unlockChapter(payment.userId, payment.mangaId, payment.chapterNumber);
        }
        break;
      case PaymentType.TIP:
        await this.processTip(payment);
        break;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        completedAt: new Date(),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: payment.userId,
        type: 'EARNING',
        title: '✅ Paiement réussi',
        body: `Votre paiement de ${payment.amount} USD a été confirmé.`,
        metadata: { paymentId: payment.id },
      },
    });

    return payment;
  }

  // ============================================
  // 3. CONFIRMER UN PAIEMENT MANUEL
  // ============================================
  async confirmManualPayment(transactionId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    if (payment.status === 'SUCCESS') {
      return payment;
    }

    return this.processSuccessfulPayment(payment.id);
  }

  // ============================================
  // 4. LISTE DES PAIEMENTS D'UN UTILISATEUR
  // ============================================
  async getUserPayments(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return {
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // 5. STATUT D'UN PAIEMENT
  // ============================================
  async getPaymentStatus(transactionId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    return {
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      completedAt: payment.completedAt,
    };
  }

  // ============================================
  // 6. WEBHOOK ORANGE MONEY
  // ============================================
  async handleOrangeMoneyWebhook(payload: any) {
    console.log('📩 Webhook Orange Money reçu:', JSON.stringify(payload, null, 2));

    const { transactionId, status } = payload;

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      console.log('❌ Paiement non trouvé:', transactionId);
      return { received: true, message: 'Transaction non trouvée' };
    }

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      await this.processSuccessfulPayment(payment.id);
      console.log(`✅ Paiement ${transactionId} confirmé via Orange Money`);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      console.log(`❌ Paiement ${transactionId} échoué via Orange Money`);
    }

    return { received: true };
  }

  // ============================================
  // 7. WEBHOOK M-PESA
  // ============================================
  async handleMpesaWebhook(payload: any) {
    console.log('📩 Webhook M-Pesa reçu:', JSON.stringify(payload, null, 2));

    const { transactionId, ResultCode, ResultDesc } = payload;

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      console.log('❌ Paiement non trouvé:', transactionId);
      return { received: true, message: 'Transaction non trouvée' };
    }

    if (ResultCode === '0') {
      await this.processSuccessfulPayment(payment.id);
      console.log(`✅ Paiement ${transactionId} confirmé via M-Pesa`);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      console.log(`❌ Paiement ${transactionId} échoué via M-Pesa: ${ResultDesc}`);
    }

    return { received: true };
  }

  // ============================================
  // 8. ACTIVER L'ABONNEMENT PREMIUM
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

  // ============================================
  // 9. DÉBLOQUER UN CHAPITRE
  // ============================================
  private async unlockChapter(userId: string, mangaId: string, chapterNumber: number) {
    console.log(`📚 Chapitre ${chapterNumber} du manga ${mangaId} débloqué pour ${userId}`);
    // Logique de déblocage à implémenter
  }

  // ============================================
  // 10. TRAITER UN POURBOIRE
  // ============================================
  private async processTip(payment: any) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: payment.mangaId },
      select: { authorId: true },
    });

    if (manga) {
      await this.prisma.creatorEarning.create({
        data: {
          creatorId: manga.authorId,
          source: 'TIP',
          amount: payment.amount,
          currency: payment.currency,
          paymentId: payment.id,
          status: 'PENDING',
        },
      });
      console.log(`💰 Pourboire de ${payment.amount} USD envoyé au créateur ${manga.authorId}`);
    }
  }
}
