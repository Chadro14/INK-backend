import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrangeMoneyService } from './orange-money.service';
import { MpesaService } from './mpesa.service';
import { InitiatePaymentDto, PaymentOperator, PaymentType } from '../dto/initiate-payment.dto';

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
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Générer un ID de transaction unique
    const transactionId = `INK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Créer la transaction en base
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        transactionId,
        amount: dto.amount,
        currency: 'USD',
        type: dto.type,
        status: 'PENDING',
        mangaId: dto.mangaId,
        chapterNumber: dto.chapterNumber,
        mobileNumber: dto.phoneNumber,
        metadata: {
          operator: dto.operator,
          description: dto.description || `Paiement ${dto.type}`,
        },
      },
    });

    // Sélectionner le bon service selon l'opérateur
    let result;
    try {
      if (dto.operator === PaymentOperator.ORANGE) {
        result = await this.orangeMoneyService.initiatePayment({
          amount: dto.amount,
          currency: 'USD',
          phoneNumber: dto.phoneNumber,
          description: dto.description || `INKDROP - ${dto.type}`,
          transactionId,
        });
      } else if (dto.operator === PaymentOperator.MPESA) {
        result = await this.mpesaService.initiatePayment({
          amount: dto.amount,
          currency: 'USD',
          phoneNumber: dto.phoneNumber,
          description: dto.description || `INKDROP - ${dto.type}`,
          transactionId,
        });
      } else {
        throw new BadRequestException('Opérateur non supporté');
      }

      // Mettre à jour la transaction
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionId: result.transactionId,
          metadata: {
            ...payment.metadata,
            providerTransactionId: result.transactionId,
          },
        },
      });

      return {
        paymentId: payment.id,
        transactionId: result.transactionId,
        status: result.status,
        message: 'Demande de paiement envoyée. Veuillez confirmer sur votre téléphone.',
      };
    } catch (error) {
      console.error('❌ Erreur de paiement:', error.message);
      return {
        paymentId: payment.id,
        transactionId,
        status: 'PENDING_MANUAL',
        message: `Veuillez envoyer ${dto.amount} USD sur le numéro +243 800 000 000 avec la référence ${transactionId}`,
      };
    }
  }

  // ============================================
  // TRAITER UN PAIEMENT RÉUSSI (WEBHOOK)
  // ============================================
  async processSuccessfulPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    // Activer le service selon le type
    switch (payment.type) {
      case PaymentType.PREMIUM:
        await this.activatePremium(payment.userId);
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

    // Mettre à jour le statut
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
      },
    });

    // Créer une notification
    await this.prisma.notification.create({
      data: {
        userId: payment.userId,
        type: 'EARNING',
        title: 'Paiement réussi',
        body: `Votre paiement de ${payment.amount} USD a été confirmé.`,
        metadata: { paymentId: payment.id },
      },
    });

    return payment;
  }

  // ============================================
  // ACTIVER LE PREMIUM
  // ============================================
  private async activatePremium(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        premiumPlan: 'MONTHLY',
      },
    });
  }

  // ============================================
  // DÉBLOQUER UN CHAPITRE
  // ============================================
  private async unlockChapter(userId: string, mangaId: string, chapterNumber: number) {
    console.log(`📚 Chapitre ${chapterNumber} du manga ${mangaId} débloqué pour ${userId}`);
  }

  // ============================================
  // PROCESSUS TIP
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
    }
  }
}