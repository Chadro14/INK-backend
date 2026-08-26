// src/modules/manas/manas.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasTransactionType, DailyActionType } from '@prisma/client';

@Injectable()
export class ManasService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RÉCUPÉRER LE SOLDE D'UN UTILISATEUR
  // ============================================
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, username: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      balance: user.manas,
      username: user.username,
      role: user.role,
    };
  }

  // ============================================
  // AJOUTER DES MANAS
  // ============================================
  async addManas(
    userId: string,
    amount: number,
    type: ManasTransactionType,
    description: string,
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
  // DÉPENSER DES MANAS
  // ============================================
  async spendManas(
    userId: string,
    amount: number,
    type: ManasTransactionType,
    description: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
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
      ManasTransactionType.GIFT_SENT,
      `Envoi de ${amount} MANAS à ${receiver.username}`,
      { receiverId, receiverUsername: receiver.username },
    );

    const result = await this.addManas(
      receiverId,
      amount,
      ManasTransactionType.GIFT_RECEIVED,
      `Reçu ${amount} MANAS de ${senderId}`,
      { senderId },
    );

    return {
      success: true,
      message: `${amount} MANAS envoyés à ${receiver.username}`,
      balance: result.balance,
    };
  }

  // ============================================
  // ✅ VÉRIFIER SI L'UTILISATEUR EST CRÉATEUR
  // ============================================
  private async isCreator(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'CREATOR' || user?.role === 'ADMIN';
  }

  // ============================================
  // ✅ VÉRIFIER SI L'UTILISATEUR EST LECTEUR
  // ============================================
  private async isReader(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'READER';
  }

  // ============================================
  // ✅ VÉRIFIER LA LIMITE QUOTIDIENNE
  // ============================================
  private async checkDailyLimit(
    userId: string,
    actionType: DailyActionType,
    maxPerDay: number,
  ): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.dailyManasAction.findUnique({
      where: {
        userId_actionType_date: {
          userId,
          actionType,
          date: today,
        },
      },
    });

    if (!existing) return true;
    return existing.count < maxPerDay;
  }

  // ============================================
  // ✅ INCRÉMENTER LE COMPTEUR QUOTIDIEN
  // ============================================
  private async incrementDailyCount(
    userId: string,
    actionType: DailyActionType,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.dailyManasAction.upsert({
      where: {
        userId_actionType_date: {
          userId,
          actionType,
          date: today,
        },
      },
      update: {
        count: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        userId,
        actionType,
        count: 1,
        date: today,
      },
    });
  }

  // ============================================
  // ✅ ACTIONS QUI GAGNENT DES MANAS (AVEC LIMITE)
  // ============================================

  // 📖 Lecture d'un chapitre (max 10/jour) - TOUT LE MONDE
  async onChapterRead(userId: string, chapterId: string, mangaId: string) {
    const canEarn = await this.checkDailyLimit(userId, DailyActionType.READ, 10);
    if (!canEarn) {
      return {
        success: false,
        message: 'Limite quotidienne de lecture atteinte (10/jour)',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const result = await this.addManas(
      userId,
      1,
      ManasTransactionType.READING,
      'Lecture d\'un chapitre',
      { chapterId, mangaId },
    );

    await this.incrementDailyCount(userId, DailyActionType.READ);

    return {
      success: true,
      message: '+1 MANAS pour la lecture',
      balance: result.balance,
    };
  }

  // ❤️ Like reçu sur un manga (max 5/jour) - UNIQUEMENT CRÉATEUR
  async onLikeReceived(userId: string, mangaId: string) {
    // ✅ Vérifier que l'utilisateur est créateur
    if (!(await this.isCreator(userId))) {
      return {
        success: false,
        message: 'Seuls les créateurs peuvent gagner des MANAS avec des likes',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const canEarn = await this.checkDailyLimit(userId, DailyActionType.LIKE, 5);
    if (!canEarn) {
      return {
        success: false,
        message: 'Limite quotidienne de likes atteinte (5/jour)',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const result = await this.addManas(
      userId,
      2,
      ManasTransactionType.LIKE_RECEIVED,
      'Like reçu sur votre manga',
      { mangaId },
    );

    await this.incrementDailyCount(userId, DailyActionType.LIKE);

    return {
      success: true,
      message: '+2 MANAS pour le like reçu',
      balance: result.balance,
    };
  }

  // 💬 Commentaire reçu (max 5/jour) - UNIQUEMENT CRÉATEUR
  async onCommentReceived(userId: string, mangaId: string) {
    // ✅ Vérifier que l'utilisateur est créateur
    if (!(await this.isCreator(userId))) {
      return {
        success: false,
        message: 'Seuls les créateurs peuvent gagner des MANAS avec des commentaires',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const canEarn = await this.checkDailyLimit(userId, DailyActionType.COMMENT, 5);
    if (!canEarn) {
      return {
        success: false,
        message: 'Limite quotidienne de commentaires atteinte (5/jour)',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const result = await this.addManas(
      userId,
      3,
      ManasTransactionType.COMMENT_RECEIVED,
      'Commentaire reçu sur votre manga',
      { mangaId },
    );

    await this.incrementDailyCount(userId, DailyActionType.COMMENT);

    return {
      success: true,
      message: '+3 MANAS pour le commentaire reçu',
      balance: result.balance,
    };
  }

  // 👥 Nouvel abonné (pas de limite) - UNIQUEMENT CRÉATEUR
  async onNewSubscriber(userId: string, followerId: string) {
    // ✅ Vérifier que l'utilisateur est créateur
    if (!(await this.isCreator(userId))) {
      return {
        success: false,
        message: 'Seuls les créateurs peuvent gagner des MANAS avec des abonnés',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    const result = await this.addManas(
      userId,
      5,
      ManasTransactionType.SUBSCRIBER,
      'Nouvel abonné',
      { followerId },
    );

    return {
      success: true,
      message: '+5 MANAS pour le nouvel abonné',
      balance: result.balance,
    };
  }

  // 🎁 Bonus quotidien (1 MANAS tous les 2 jours) - TOUT LE MONDE
  async dailyBonus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.manasTransaction.findFirst({
      where: {
        userId,
        type: ManasTransactionType.DAILY_BONUS,
        createdAt: { gte: today },
      },
    });

    if (existing) {
      throw new BadRequestException('Bonus déjà réclamé aujourd\'hui');
    }

    return this.addManas(
      userId,
      1,
      ManasTransactionType.DAILY_BONUS,
      'Bonus quotidien (1 MANAS)',
      { date: new Date().toISOString() },
    );
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
      ManasTransactionType.CHAPTER_PURCHASE,
      `Achat du chapitre ${chapterNumber}`,
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
      ManasTransactionType.COLLABORATION,
      `Collaboration avec ${creator.username}`,
      { creatorId, creatorUsername: creator.username },
    );

    await this.addManas(
      creatorId,
      amountInManas * 0.7,
      ManasTransactionType.COLLABORATION,
      `Collaboration de ${userId}`,
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
}
