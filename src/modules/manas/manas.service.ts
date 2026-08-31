// src/modules/manas/manas.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasTransactionType } from '@prisma/client';

@Injectable()
export class ManasService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RÉCUPÉRER LE SOLDE D'UN UTILISATEUR
  // ============================================
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, username: true, role: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      balance: user.manas,
      username: user.username,
      role: user.role,
      premiumActive: user.premiumActive,
    };
  }

  // ============================================
  // CONSOMMER 1 MANA POUR REGARDER UN ANIME
  // ============================================
  async consumeMana(userId: string, animeId: string, episodeNumber: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.premiumActive) {
      return {
        success: true,
        message: 'Accès Premium - Visionnage gratuit',
        remainingManas: user.manas,
      };
    }

    if (user.manas < 1) {
      throw new BadRequestException('MANAS insuffisants pour regarder cet épisode (1 MANAS requis)');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { manas: { decrement: 1 } },
    });

    await this.prisma.manasTransaction.create({
      data: {
        userId,
        amount: -1,
        type: ManasTransactionType.READING,
        description: `Visionnage de l'épisode ${episodeNumber}`,
        metadata: { animeId, episodeNumber },
      },
    });

    return {
      success: true,
      message: '1 MANAS consommé',
      remainingManas: updatedUser.manas,
    };
  }

  // ============================================
  // AJOUTER DES MANAS - SIGNATURE CORRIGÉE
  // ============================================
  async addManas(
    userId: string,
    amount: number,
    description: string,
    type: ManasTransactionType,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const [user, transaction] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { manas: { increment: amount } },
      }),
      this.prisma.manasTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          metadata: metadata || null,
        },
      }),
    ]);

    return {
      balance: user.manas,
      transaction,
    };
  }

  // ============================================
  // DÉPENSER DES MANAS - SIGNATURE CORRIGÉE
  // ============================================
  async spendManas(
    userId: string,
    amount: number,
    description: string,
    type: ManasTransactionType,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.premiumActive && type === ManasTransactionType.CHAPTER_PURCHASE) {
      return {
        success: true,
        message: 'Accès Premium - Chapitre débloqué',
        balance: user.manas,
      };
    }

    if (user.manas < amount) {
      throw new BadRequestException('Solde de MANAS insuffisant');
    }

    const [updated, transaction] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { manas: { decrement: amount } },
      }),
      this.prisma.manasTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
          metadata: metadata || null,
        },
      }),
    ]);

    return {
      balance: updated.manas,
      transaction,
    };
  }

  // ============================================
  // ENVOYER DES MANAS À UN AMI
  // ============================================
  async sendManas(
    senderId: string,
    receiverId: string,
    amount: number,
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException('Vous ne pouvez pas vous envoyer des MANAS à vous-même');
    }

    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, username: true },
    });

    if (!receiver) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.spendManas(
      senderId,
      amount,
      `Envoi de ${amount} MANAS à ${receiver.username}`,
      ManasTransactionType.GIFT_SENT,
      { receiverId, receiverUsername: receiver.username },
    );

    const result = await this.addManas(
      receiverId,
      amount,
      `Reçu ${amount} MANAS de ${senderId}`,
      ManasTransactionType.GIFT_RECEIVED,
      { senderId },
    );

    return {
      success: true,
      message: `${amount} MANAS envoyés à ${receiver.username}`,
      balance: result.balance,
    };
  }

  // ============================================
  // VÉRIFIER SI L'UTILISATEUR EST CRÉATEUR
  // ============================================
  private async isCreator(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'CREATOR' || user?.role === 'ADMIN';
  }

  // ============================================
  // ACHETER UN CHAPITRE AVEC DES MANAS
  // ============================================
  async purchaseChapter(
    userId: string,
    mangaId: string,
    chapterNumber: number,
    priceInManas: number = 50,
  ) {
    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: chapterNumber,
        },
      },
      select: { id: true, title: true, mangaId: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    const result = await this.spendManas(
      userId,
      priceInManas,
      `Achat du chapitre ${chapterNumber}`,
      ManasTransactionType.CHAPTER_PURCHASE,
      { mangaId, chapterNumber, chapterId: chapter.id },
    );

    return {
      success: true,
      message: `Chapitre ${chapterNumber} débloqué avec succès`,
      balance: result.balance,
    };
  }

  // ============================================
  // COLLABORATION AVEC UN DESSINATEUR
  // ============================================
  async collaborateWithCreator(
    userId: string,
    creatorId: string,
    amountInManas: number = 250,
  ) {
    if (userId === creatorId) {
      throw new BadRequestException('Vous ne pouvez pas collaborer avec vous-même');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, username: true, role: true },
    });

    if (!creator) {
      throw new NotFoundException('Créateur non trouvé');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'ADMIN') {
      throw new BadRequestException('Cet utilisateur n\'est pas un créateur');
    }

    const result = await this.spendManas(
      userId,
      amountInManas,
      `Collaboration avec ${creator.username}`,
      ManasTransactionType.COLLABORATION,
      { creatorId, creatorUsername: creator.username },
    );

    await this.addManas(
      creatorId,
      amountInManas * 0.7,
      `Collaboration de ${userId}`,
      ManasTransactionType.COLLABORATION,
      { userId },
    );

    return {
      success: true,
      message: `Collaboration avec ${creator.username} réussie`,
      balance: result.balance,
    };
  }

  // ============================================
  // HISTORIQUE DES TRANSACTIONS
  // ============================================
  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: ManasTransactionType,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.manasTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.manasTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // RÉCUPÉRER LES STATISTIQUES MANAS D'UN UTILISATEUR
  // ============================================
  async getManasStats(userId: string) {
    const [totalEarned, totalSpent] = await Promise.all([
      this.prisma.manasTransaction.aggregate({
        where: { userId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.manasTransaction.aggregate({
        where: { userId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalEarned: totalEarned._sum.amount || 0,
      totalSpent: Math.abs(totalSpent._sum.amount || 0),
    };
  }

  // ============================================
  // GAGNER DES MANAS POUR UNE ACTION QUOTIDIENNE
  // ============================================
  async earnDailyManas(
    userId: string,
    actionType: string,
    amount: number = 1,
  ) {
    // Vérifier la limite quotidienne
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayActions = await this.prisma.dailyManasAction.findUnique({
      where: {
        userId_actionType_date: {
          userId,
          actionType: actionType as any,
          date: today,
        },
      },
    });

    const maxDaily = 10; // Max 10 actions par jour par type

    if (todayActions && todayActions.count >= maxDaily) {
      return {
        success: false,
        message: `Limite quotidienne atteinte pour ${actionType} (${maxDaily}/jour)`,
        earned: 0,
        total: todayActions.count,
      };
    }

    // Ajouter les MANAS
    await this.addManas(
      userId,
      amount,
      `Gain MANAS pour ${actionType}`,
      ManasTransactionType.DAILY_BONUS,
      { actionType },
    );

    // Mettre à jour le compteur quotidien
    const updated = await this.prisma.dailyManasAction.upsert({
      where: {
        userId_actionType_date: {
          userId,
          actionType: actionType as any,
          date: today,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        userId,
        actionType: actionType as any,
        date: today,
        count: 1,
      },
    });

    return {
      success: true,
      message: `+${amount} MANAS pour ${actionType}`,
      earned: amount,
      total: updated.count,
    };
  }
}
