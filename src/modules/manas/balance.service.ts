// src/modules/manas/balance.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

const RATE = 100; // 100 MANAS = 1 USD
const MIN_WITHDRAWAL_MANAS = 1000; // 10 USD
const WITHDRAWAL_FEE_USD = 2; // 2 USD fixes
const MAX_DAILY_WITHDRAWAL_USD = 50; // 50 USD/jour max

@Injectable()
export class BalanceService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // DEMANDE DE RETRAIT
  // ============================================
  async requestWithdrawal(
    userId: string,
    manasAmount: number,
    mobileNumber: string,
    operator: string,
  ) {
    // 1. Validation des entrées
    if (!manasAmount || manasAmount <= 0) {
      throw new BadRequestException('Montant invalide');
    }

    if (!mobileNumber || !mobileNumber.trim()) {
      throw new BadRequestException('Numéro de téléphone requis');
    }

    const cleanMobile = mobileNumber.trim();

    // 2. Vérifier l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, role: true, username: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role !== 'CREATOR' && user.role !== 'ADMIN') {
      throw new BadRequestException(
        'Seuls les créateurs peuvent retirer des MANAS',
      );
    }

    if (user.manas < manasAmount) {
      throw new BadRequestException('Solde insuffisant');
    }

    if (manasAmount < MIN_WITHDRAWAL_MANAS) {
      throw new BadRequestException(
        `Le montant minimum est de ${MIN_WITHDRAWAL_MANAS} MANAS (10 USD)`,
      );
    }

    // 3. Calculer le montant net
    const usdAmount = manasAmount / RATE;
    const fee = WITHDRAWAL_FEE_USD;
    const netAmount = usdAmount - fee;

    if (netAmount <= 0) {
      throw new BadRequestException(
        'Le montant du retrait doit être supérieur aux frais (2 USD)',
      );
    }

    // 4. Vérifier le plafond journalier
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPayouts = await this.prisma.payout.findMany({
      where: {
        creatorId: userId,
        requestedAt: { gte: today },
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
      },
      select: { amount: true, metadata: true },
    });

    const totalTodayUSD = todayPayouts.reduce((acc, p) => {
      const gross = (p.metadata as any)?.grossAmount || p.amount;
      return acc + gross;
    }, 0);

    if (totalTodayUSD + usdAmount > MAX_DAILY_WITHDRAWAL_USD) {
      throw new BadRequestException(
        `Plafond journalier de ${MAX_DAILY_WITHDRAWAL_USD} USD dépassé. Déjà retiré aujourd'hui : ${totalTodayUSD.toFixed(2)} USD`,
      );
    }

    // 5. Trouver le compte plateforme
    const platformAccount = await this.prisma.user.findFirst({
      where: { isPlatformAccount: true },
      select: { id: true, username: true },
    });

    if (!platformAccount) {
      throw new NotFoundException(
        'Compte plateforme non configuré. Contactez un administrateur.',
      );
    }

    // 6. Créer la demande + débiter + créditer plateforme + notifications
    const feeInManas = fee * RATE; // 200 MANAS

    const payout = await this.prisma.$transaction(async (tx) => {
      // 6a. Créer la demande
      const createdPayout = await tx.payout.create({
        data: {
          creatorId: userId,
          amount: netAmount,
          currency: 'USD',
          mobileNumber: cleanMobile,
          status: 'PENDING',
          metadata: {
            manasAmount,
            operator,
            fee,
            feeInManas,
            grossAmount: usdAmount,
            netAmount,
            platformAccountId: platformAccount.id,
          },
        },
      });

      // 6b. Débiter le créateur
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { manas: { decrement: manasAmount } },
        select: { manas: true },
      });

      // 6c. Transaction du créateur (retrait)
      await tx.manasTransaction.create({
        data: {
          userId,
          amount: -manasAmount,
          type: 'BALANCE_WITHDRAWAL',
          description: `Retrait de ${manasAmount} MANAS (${netAmount.toFixed(2)} USD net)`,
          metadata: {
            manasAmount,
            usdAmount,
            netAmount,
            fee,
            feeInManas,
            payoutId: createdPayout.id,
          },
        },
      });

      // 6d. Créditer le compte plateforme (frais en MANAS)
      await tx.user.update({
        where: { id: platformAccount.id },
        data: { manas: { increment: feeInManas } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: platformAccount.id,
          amount: feeInManas,
          type: 'ADMIN_GRANT',
          description: `Frais de retrait (${fee} USD) — @${user.username}`,
          metadata: {
            payoutId: createdPayout.id,
            fromUserId: userId,
            feeUSD: fee,
          },
        },
      });

      // 6e. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'WITHDRAWAL_REQUESTED',
          targetId: createdPayout.id,
          targetType: 'PAYOUT',
          details: {
            manasAmount,
            netAmount,
            fee,
            operator,
            mobileNumber: cleanMobile,
          },
        },
      });

      return { payout: createdPayout, balance: updatedUser.manas };
    });

    // 7. Notifier le créateur
    await this.notificationsService.create({
      userId,
      type: NotificationType.SYSTEM,
      title: 'Demande de retrait reçue',
      body: `Votre demande de retrait de ${netAmount.toFixed(2)} USD est en attente de validation.`,
      link: `/creator/balance`,
      metadata: { payoutId: payout.payout.id },
    });

    return {
      success: true,
      message: 'Demande de retrait envoyée',
      withdrawal: {
        id: payout.payout.id,
        amount: netAmount,
        status: payout.payout.status,
        manasAmount,
        fee,
      },
      balance: payout.balance,
    };
  }

  // ============================================
  // HISTORIQUE DES RETRAITS
  // ============================================
  async getWithdrawalHistory(userId: string) {
    const payouts = await this.prisma.payout.findMany({
      where: { creatorId: userId },
      orderBy: { requestedAt: 'desc' },
    });

    return payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      manasAmount: (p.metadata as any)?.manasAmount || 0,
      fee: (p.metadata as any)?.fee || 0,
      grossAmount: (p.metadata as any)?.grossAmount || 0,
      status: p.status,
      mobileNumber: p.mobileNumber,
      operator: (p.metadata as any)?.operator || 'orange',
      rejectionReason: (p.metadata as any)?.rejectionReason || null,
      createdAt: p.requestedAt,
      completedAt: p.completedAt,
    }));
  }

  // ============================================
  // ADMIN : VALIDER UN RETRAIT
  // ============================================
  async approveWithdrawal(adminId: string, payoutId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new BadRequestException(
        'Seuls les administrateurs peuvent valider les retraits',
      );
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Retrait non trouvé');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException('Ce retrait a déjà été traité');
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        transactionId: `PAY-${Date.now()}`,
      },
    });

    // Notifier le créateur
    await this.notificationsService.create({
      userId: payout.creatorId,
      type: NotificationType.SYSTEM,
      title: 'Retrait en traitement',
      body: `Votre retrait de ${payout.amount.toFixed(2)} USD est en cours de traitement.`,
      link: `/creator/balance`,
      metadata: { payoutId },
    });

    return updated;
  }

  // ============================================
  // ADMIN : COMPLÉTER UN RETRAIT
  // ============================================
  async completeWithdrawal(adminId: string, payoutId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new BadRequestException(
        'Seuls les administrateurs peuvent compléter les retraits',
      );
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Retrait non trouvé');
    }

    if (payout.status !== 'PROCESSING') {
      throw new BadRequestException("Ce retrait n'est pas en traitement");
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Notifier le créateur
    await this.notificationsService.create({
      userId: payout.creatorId,
      type: NotificationType.SYSTEM,
      title: 'Retrait envoyé',
      body: `Votre retrait de ${payout.amount.toFixed(2)} USD a été envoyé au ${payout.mobileNumber}.`,
      link: `/creator/balance`,
      metadata: { payoutId },
    });

    // Audit
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_COMPLETED',
        targetId: payoutId,
        targetType: 'PAYOUT',
        details: { amount: payout.amount, creatorId: payout.creatorId },
      },
    });

    return updated;
  }

  // ============================================
  // ADMIN : REJETER UN RETRAIT
  // ============================================
  async rejectWithdrawal(adminId: string, payoutId: string, reason: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new BadRequestException(
        'Seuls les administrateurs peuvent rejeter les retraits',
      );
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Retrait non trouvé');
    }

    if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') {
      throw new BadRequestException('Ce retrait ne peut pas être rejeté');
    }

    const metadata = (payout.metadata as any) || {};
    const manasAmount = metadata.manasAmount || 0;
    const feeInManas = metadata.feeInManas || 0;
    const platformAccountId = metadata.platformAccountId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Marquer comme FAILED
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          metadata: {
            ...metadata,
            rejectionReason: reason || 'Rejeté par admin',
            rejectedAt: new Date().toISOString(),
          },
        },
      });

      // 2. Rembourser le créateur
      await tx.user.update({
        where: { id: payout.creatorId },
        data: { manas: { increment: manasAmount } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: payout.creatorId,
          amount: manasAmount,
          type: 'BALANCE_DEPOSIT',
          description: `Remboursement — retrait refusé (${manasAmount} MANAS)`,
          metadata: {
            payoutId,
            reason: reason || 'Rejeté par admin',
          },
        },
      });

      // 3. Retirer les frais du compte plateforme
      if (platformAccountId && feeInManas > 0) {
        await tx.user.update({
          where: { id: platformAccountId },
          data: { manas: { decrement: feeInManas } },
        });

        await tx.manasTransaction.create({
          data: {
            userId: platformAccountId,
            amount: -feeInManas,
            type: 'ADMIN_GRANT',
            description: `Annulation des frais de retrait (refus)`,
            metadata: { payoutId, fromUserId: payout.creatorId },
          },
        });
      }
    });

    // Notifier le créateur
    await this.notificationsService.create({
      userId: payout.creatorId,
      type: NotificationType.SYSTEM,
      title: 'Retrait refusé',
      body: `Votre retrait a été refusé. ${manasAmount} MANAS vous ont été remboursés. Raison : ${reason || 'non précisée'}`,
      link: `/creator/balance`,
      metadata: { payoutId, reason },
    });

    // Audit
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'WITHDRAWAL_REJECTED',
        targetId: payoutId,
        targetType: 'PAYOUT',
        details: { reason, manasAmount, creatorId: payout.creatorId },
      },
    });

    return { success: true, message: 'Retrait rejeté et remboursé' };
  }
}
