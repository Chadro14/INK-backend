import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManasTransactionType, NotificationType } from '@prisma/client';
import { MANAS_CONFIG } from '../../common/constants/manas.config';

@Injectable()
export class ManasService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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

    const cost = MANAS_CONFIG.ANIME_EPISODE_COST;

    if (user.manas < cost) {
      throw new BadRequestException(
        `MANAS insuffisants pour regarder cet épisode (${cost} MANAS requis)`,
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { manas: { decrement: cost } },
    });

    await this.prisma.manasTransaction.create({
      data: {
        userId,
        amount: -cost,
        type: ManasTransactionType.READING,
        description: `Visionnage de l'épisode ${episodeNumber}`,
        metadata: { animeId, episodeNumber },
      },
    });

    return {
      success: true,
      message: `${cost} MANAS consommé`,
      remainingManas: updatedUser.manas,
    };
  }

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

  async sendManas(senderId: string, receiverId: string, amount: number) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer des MANAS à vous-même',
      );
    }

    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    if (amount > MANAS_CONFIG.SEND_MAX_AMOUNT) {
      throw new BadRequestException(
        `Le montant maximum par envoi est de ${MANAS_CONFIG.SEND_MAX_AMOUNT} MANAS`,
      );
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, username: true },
    });

    if (!receiver) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, username: true },
    });

    if (!sender) {
      throw new NotFoundException('Expéditeur non trouvé');
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
      `Reçu ${amount} MANAS de ${sender.username}`,
      ManasTransactionType.GIFT_RECEIVED,
      { senderId, senderUsername: sender.username },
    );

    await this.notificationsService.create({
      userId: receiverId,
      fromUserId: senderId,
      type: NotificationType.EARNING,
      title: 'MANAS reçus',
      body: `@${sender.username} vous a envoyé ${amount} MANAS`,
      link: `/creator/${sender.username}`,
      metadata: { senderId, amount },
    });

    return {
      success: true,
      message: `${amount} MANAS envoyés à ${receiver.username}`,
      balance: result.balance,
    };
  }

  private async isCreator(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'CREATOR' || user?.role === 'ADMIN';
  }

  async purchaseChapter(
    userId: string,
    mangaId: string,
    chapterNumber: number,
    priceInManas: number = MANAS_CONFIG.CHAPTER_COST_DEFAULT,
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

  async collaborateWithCreator(
    userId: string,
    creatorId: string,
    amountInManas: number = MANAS_CONFIG.COLLABORATION_COST,
  ) {
    if (userId === creatorId) {
      throw new BadRequestException(
        'Vous ne pouvez pas collaborer avec vous-même',
      );
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, username: true, role: true },
    });

    if (!creator) {
      throw new NotFoundException('Créateur non trouvé');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'ADMIN') {
      throw new BadRequestException("Cet utilisateur n'est pas un créateur");
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
      amountInManas * MANAS_CONFIG.CREATOR_SHARE,
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

  async earnDailyManas(
    userId: string,
    actionType: string,
    amount: number = MANAS_CONFIG.DAILY_ACTION_REWARD,
  ) {
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

    if (
      todayActions &&
      todayActions.count >= MANAS_CONFIG.DAILY_MAX_ACTIONS
    ) {
      return {
        success: false,
        message: `Limite quotidienne atteinte pour ${actionType} (${MANAS_CONFIG.DAILY_MAX_ACTIONS}/jour)`,
        earned: 0,
        total: todayActions.count,
      };
    }

    await this.addManas(
      userId,
      amount,
      `Gain MANAS pour ${actionType}`,
      ManasTransactionType.DAILY_BONUS,
      { actionType },
    );

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
