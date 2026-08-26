// src/modules/manas/balance.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BalanceService {
  private readonly RATE = 100; // 100 MANAS = 1$
  private readonly MIN_WITHDRAWAL_MANAS = 909; // 10$
  private readonly FEE_RATE = 0.05; // 5%

  constructor(private prisma: PrismaService) {}

  // ============================================
  // DEMANDE DE RETRAIT (CORRIGÉ)
  // ============================================
  async requestWithdrawal(
    userId: string,
    manasAmount: number,
    mobileNumber: string,
    operator: string,
  ) {
    // 1. Vérifier le solde
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role !== 'CREATOR' && user.role !== 'ADMIN') {
      throw new BadRequestException('Seuls les créateurs peuvent retirer des MANAS');
    }

    if (user.manas < manasAmount) {
      throw new BadRequestException('Solde insuffisant');
    }

    if (manasAmount < this.MIN_WITHDRAWAL_MANAS) {
      throw new BadRequestException(`Le montant minimum est de ${this.MIN_WITHDRAWAL_MANAS} MANAS (10$)`);
    }

    // 2. Calculer le montant
    const usdAmount = manasAmount / this.RATE;
    const fee = usdAmount * this.FEE_RATE;
    const netAmount = usdAmount - fee;

    // 3. Créer la demande de retrait
    const payout = await this.prisma.payout.create({
      data: {
        creatorId: userId,
        amount: netAmount,
        currency: 'USD',
        mobileNumber: mobileNumber,
        status: 'PENDING',
        metadata: {
          manasAmount,
          operator,
          fee,
          grossAmount: usdAmount,
        },
      },
    });

    // 4. Mettre à jour le solde et créer la transaction
    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { manas: { decrement: manasAmount } },
      }),
      this.prisma.manasTransaction.create({
        data: {
          userId,
          amount: -manasAmount,
          type: 'BALANCE_WITHDRAWAL',
          description: `Retrait de ${manasAmount} MANAS (${netAmount.toFixed(2)}$)`,
          metadata: {
            manasAmount,
            usdAmount: netAmount,
            fee,
            payoutId: payout.id,
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Demande de retrait envoyée',
      withdrawal: {
        id: payout.id,
        amount: netAmount,
        status: payout.status,
        manasAmount,
      },
      balance: updatedUser.manas,
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
      status: p.status,
      mobileNumber: p.mobileNumber,
      operator: (p.metadata as any)?.operator || 'orange',
      createdAt: p.requestedAt,
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
      throw new BadRequestException('Seuls les administrateurs peuvent valider les retraits');
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
      throw new BadRequestException('Seuls les administrateurs peuvent compléter les retraits');
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException('Retrait non trouvé');
    }

    if (payout.status !== 'PROCESSING') {
      throw new BadRequestException('Ce retrait n\'est pas en traitement');
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
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
      throw new BadRequestException('Seuls les administrateurs peuvent rejeter les retraits');
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

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        metadata: {
          ...(payout.metadata as any || {}),
          rejectionReason: reason,
        },
      },
    });

    // Rembourser les MANAS
    await this.prisma.user.update({
      where: { id: payout.creatorId },
      data: { manas: { increment: (payout.metadata as any)?.manasAmount || 0 } },
    });

    return updated;
  }
}
