// src/modules/payments/services/payments.service.ts
import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentType, PaymentStatus, PremiumPlan } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrangeMoneyService } from './orange-money.service';
import { MpesaService } from './mpesa.service';
import { InitiatePaymentDto, PaymentOperator } from '../dto/initiate-payment.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly webhookSecret: string;

  // ✅ MAP PAYS → PAYS PAWAPAY
  private readonly countryMap: Record<string, { code: string; providers: string[] }> = {
    'RDC': { code: 'CD', providers: ['ORANGE_CD', 'VODACOM_CD'] },
    'Kenya': { code: 'KE', providers: ['SAFARICOM_MPESA'] },
    'Ghana': { code: 'GH', providers: ['MTN_MOMO_GH', 'VODAFONE_GH'] },
    'Zambie': { code: 'ZM', providers: ['MTN_MOMO_ZMB', 'AIRTEL_ZMB'] },
    'Côte d\'Ivoire': { code: 'CI', providers: ['ORANGE_CI', 'MTN_MOMO_CI'] },
    'Sénégal': { code: 'SN', providers: ['ORANGE_SN', 'WAVE_SN'] },
    'Cameroun': { code: 'CM', providers: ['ORANGE_CM', 'MTN_MOMO_CM'] },
    'Bénin': { code: 'BJ', providers: ['MTN_MOMO_BJ', 'MOOV_BJ'] },
    'Burkina Faso': { code: 'BF', providers: ['ORANGE_BF', 'MOOV_BF'] },
    'Gabon': { code: 'GA', providers: ['ORANGE_GA', 'AIRTEL_GA'] },
    'Mozambique': { code: 'MZ', providers: ['VODACOM_MZ', 'MPESA_MZ'] },
    'Niger': { code: 'NE', providers: ['ORANGE_NE', 'MOOV_NE'] },
    'Rwanda': { code: 'RW', providers: ['MTN_MOMO_RW'] },
    'Sierra Leone': { code: 'SL', providers: ['ORANGE_SL'] },
    'Tanzanie': { code: 'TZ', providers: ['VODACOM_TZ', 'AIRTEL_TZ'] },
    'Ouganda': { code: 'UG', providers: ['MTN_MOMO_UG', 'AIRTEL_UG'] },
  };

  constructor(
    private prisma: PrismaService,
    private orangeMoneyService: OrangeMoneyService,
    private mpesaService: MpesaService,
    private configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get('PAWAPAY_WEBHOOK_SECRET') || '';
  }

  // ============================================
  // ✅ 1. VALIDER LE NUMÉRO SELON L'OPÉRATEUR
  // ============================================
  private validatePhoneNumber(operator: PaymentOperator, phoneNumber: string): boolean {
    const clean = phoneNumber.replace(/\D/g, '');

    // ✅ Validation de base : longueur
    if (clean.length < 7 || clean.length > 15) {
      return false;
    }

    // ✅ Validation spécifique selon l'opérateur
    switch (operator) {
      case PaymentOperator.MPESA:
        // M-Pesa : commence par 08, 09, ou 7 (Kenya)
        return /^(07|08|09|7)\d{7,13}$/.test(clean);

      case PaymentOperator.ORANGE:
        // Orange Money : commence par 07, 08, ou 77
        return /^(07|08|77|78|79)\d{7,13}$/.test(clean);

      default:
        return true;
    }
  }

  // ============================================
  // ✅ 2. DÉTECTER OU RETOURNER LE PROVIDER PAWAPAY
  // ============================================
  private getProvider(operator: PaymentOperator, country?: string): string {
    // Si le pays est spécifié, utiliser le mapping
    if (country && this.countryMap[country]) {
      const countryData = this.countryMap[country];
      // Retourner le premier provider du pays
      return countryData.providers[0] || 'ORANGE_CD';
    }

    // Fallback selon l'opérateur
    switch (operator) {
      case PaymentOperator.MPESA:
        return 'VODACOM_CD';
      case PaymentOperator.ORANGE:
        return 'ORANGE_CD';
      default:
        return 'ORANGE_CD';
    }
  }

  // ============================================
  // 3. INITIER UN PAIEMENT
  // ============================================
  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // ✅ VALIDER LE NUMÉRO DE TÉLÉPHONE
    if (!this.validatePhoneNumber(dto.operator, dto.phoneNumber)) {
      throw new BadRequestException(
        `Numéro de téléphone invalide pour ${dto.operator}. Veuillez vérifier votre numéro.`
      );
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
          country: dto.country || 'RDC',
          provider: this.getProvider(dto.operator, dto.country),
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
      await this.activatePremium(payment.userId, planValue || PremiumPlan.MONTHLY);

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
      // ✅ Appel au bon service selon l'opérateur
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
  // 4. TRAITER UN PAIEMENT RÉUSSI (AVEC TRANSACTION ATOMIQUE)
  // ============================================
  async processSuccessfulPayment(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException('Paiement non trouvé');
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        console.log(`⏭️ Paiement ${payment.transactionId} déjà traité (idempotence)`);
        return payment;
      }

      switch (payment.type) {
        case PaymentType.PREMIUM:
          await this.activatePremium(tx, payment.userId, payment.plan || PremiumPlan.MONTHLY);
          break;
        case PaymentType.CHAPTER:
          if (payment.mangaId && payment.chapterNumber) {
            await this.unlockChapter(tx, payment.userId, payment.mangaId, payment.chapterNumber);
          }
          break;
        case PaymentType.TIP:
          await this.processTip(tx, payment);
          break;
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          completedAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: 'EARNING',
          title: '✅ Paiement réussi',
          body: `Votre paiement de ${payment.amount} USD a été confirmé.`,
          metadata: { paymentId: payment.id },
        },
      });

      console.log(`✅ Paiement ${payment.transactionId} traité avec succès`);
      return updated;
    });
  }

  // ============================================
  // 5. CONFIRMER UN PAIEMENT MANUEL
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
  // 6. LISTE DES PAIEMENTS D'UN UTILISATEUR
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
  // 7. STATUT D'UN PAIEMENT
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
  // 8. WEBHOOK ORANGE MONEY (AVEC SIGNATURE)
  // ============================================
  async handleOrangeMoneyWebhook(payload: any, signature?: string) {
    console.log('📩 Webhook Orange Money reçu:', JSON.stringify(payload, null, 2));

    if (signature && this.webhookSecret) {
      if (!this.verifySignature(payload, signature, this.webhookSecret)) {
        throw new UnauthorizedException('Signature webhook invalide');
      }
    }

    const { transactionId, status } = payload;

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      console.log('❌ Paiement non trouvé:', transactionId);
      return { received: true, message: 'Transaction non trouvée' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      console.log(`⏭️ Webhook ignoré: paiement ${transactionId} déjà traité`);
      return { received: true, alreadyProcessed: true };
    }

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      await this.processSuccessfulPayment(payment.id);
      console.log(`✅ Paiement ${transactionId} confirmé via Orange Money`);
    } else if (status === 'REJECTED' || status === 'FAILED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      console.log(`❌ Paiement ${transactionId} rejeté/échoué via Orange Money`);
    } else {
      console.log(`⏳ Paiement ${transactionId} en attente (statut: ${status})`);
    }

    return { received: true };
  }

  // ============================================
  // 9. WEBHOOK M-PESA (AVEC SIGNATURE)
  // ============================================
  async handleMpesaWebhook(payload: any, signature?: string) {
    console.log('📩 Webhook M-Pesa reçu:', JSON.stringify(payload, null, 2));

    if (signature && this.webhookSecret) {
      if (!this.verifySignature(payload, signature, this.webhookSecret)) {
        throw new UnauthorizedException('Signature webhook invalide');
      }
    }

    const { transactionId, ResultCode, ResultDesc } = payload;

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      console.log('❌ Paiement non trouvé:', transactionId);
      return { received: true, message: 'Transaction non trouvée' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      console.log(`⏭️ Webhook ignoré: paiement ${transactionId} déjà traité`);
      return { received: true, alreadyProcessed: true };
    }

    if (ResultCode === '0') {
      await this.processSuccessfulPayment(payment.id);
      console.log(`✅ Paiement ${transactionId} confirmé via M-Pesa`);
    } else if (ResultCode === '1037' || ResultCode === '1032' || ResultCode === '1030') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      console.log(`❌ Paiement ${transactionId} rejeté via M-Pesa: ${ResultDesc}`);
    } else {
      console.log(`⏳ Paiement ${transactionId} en attente (ResultCode: ${ResultCode})`);
    }

    return { received: true };
  }

  // ============================================
  // 10. VALIDATION M-PESA
  // ============================================
  async handleMpesaValidation(payload: any) {
    console.log('📩 Validation M-Pesa reçue:', JSON.stringify(payload, null, 2));
    return { ResultCode: '0', ResultDesc: 'Accepté' };
  }

  // ============================================
  // 11. WEBHOOK PAWAPAY
  // ============================================
  async handlePawaPayWebhook(payload: any, signature?: string) {
    console.log('📩 Webhook PawaPay reçu:', JSON.stringify(payload, null, 2));

    if (signature && this.webhookSecret) {
      if (!this.verifySignature(payload, signature, this.webhookSecret)) {
        throw new UnauthorizedException('Signature webhook invalide');
      }
    }

    const { depositId, status } = payload;

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: depositId },
    });

    if (!payment) {
      console.log('❌ Paiement non trouvé:', depositId);
      return { received: true, message: 'Transaction non trouvée' };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      console.log(`⏭️ Webhook ignoré: paiement ${depositId} déjà traité`);
      return { received: true, alreadyProcessed: true };
    }

    if (status === 'COMPLETED') {
      await this.processSuccessfulPayment(payment.id);
      console.log(`✅ Paiement ${depositId} confirmé via PawaPay`);
    } else if (status === 'FAILED' || status === 'REJECTED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      console.log(`❌ Paiement ${depositId} échoué via PawaPay`);
    } else {
      console.log(`⏳ Paiement ${depositId} en attente (statut: ${status})`);
    }

    return { received: true };
  }

  // ============================================
  // 12. VÉRIFIER LA SIGNATURE DU WEBHOOK
  // ============================================
  private verifySignature(payload: any, signature: string, secret: string): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch (error) {
      console.error('❌ Erreur vérification signature:', error);
      return false;
    }
  }

  // ============================================
  // 13. ACTIVER L'ABONNEMENT PREMIUM (AVEC TRANSACTION)
  // ============================================
  private async activatePremium(tx: any, userId: string, plan: PremiumPlan = PremiumPlan.MONTHLY) {
    const duration = plan === PremiumPlan.YEARLY ? 365 : 30;

    await tx.user.update({
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
  // 14. DÉBLOQUER UN CHAPITRE (AVEC TRANSACTION)
  // ============================================
  private async unlockChapter(tx: any, userId: string, mangaId: string, chapterNumber: number) {
    console.log(`📚 Chapitre ${chapterNumber} du manga ${mangaId} débloqué pour ${userId}`);
  }

  // ============================================
  // 15. TRAITER UN POURBOIRE (AVEC TRANSACTION)
  // ============================================
  private async processTip(tx: any, payment: any) {
    const manga = await tx.manga.findUnique({
      where: { id: payment.mangaId },
      select: { authorId: true },
    });

    if (manga) {
      await tx.creatorEarning.create({
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
