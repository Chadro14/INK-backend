// src/modules/manas/manas.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasTransactionType, DailyActionType } from '@prisma/client';

@Injectable()
export class ManasService {
  private readonly VIEW_TO_MANAS_RATE = 1000; // 1000 vues = 1 MANAS

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
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // ✅ LES PREMIUM N'ONT PAS BESOIN DE MANAS POUR LIRE
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
  // ✅ GAIN DE MANAS POUR LES VUES (1000 VUES = 1 MANAS)
  // ============================================
  async onViewsEarned(userId: string) {
    // 1. Vérifier que l'utilisateur est créateur
    if (!(await this.isCreator(userId))) {
      return {
        success: false,
        message: 'Seuls les créateurs peuvent gagner des MANAS avec les vues',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    // 2. Calculer le nombre total de vues sur tous ses mangas
    const totalViews = await this.prisma.manga.aggregate({
      where: { authorId: userId },
      _sum: { viewsCount: true },
    });

    const views = totalViews._sum.viewsCount || 0;
    const manasToAdd = Math.floor(views / this.VIEW_TO_MANAS_RATE); // 1000 vues = 1 MANAS

    // 3. Vérifier si le créateur a déjà été crédité pour ce nombre de vues
    const lastViewTransaction = await this.prisma.manasTransaction.findFirst({
      where: {
        userId,
        type: 'VIEWS_EARNED',
      },
      orderBy: { createdAt: 'desc' },
    });

    let lastViewsCount = 0;
    if (lastViewTransaction?.metadata) {
      const metadata = lastViewTransaction.metadata as any;
      lastViewsCount = metadata?.viewsCount || 0;
    }

    const newManas = manasToAdd - Math.floor(lastViewsCount / this.VIEW_TO_MANAS_RATE);

    if (newManas <= 0) {
      return {
        success: false,
        message: 'Aucun nouveau MANAS à gagner (vues: ' + views + ')',
        balance: (await this.getBalance(userId)).balance,
      };
    }

    // 4. Ajouter les MANAS
    const result = await this.addManas(
      userId,
      newManas,
      ManasTransactionType.VIEWS_EARNED,
      `${newManas} MANAS pour ${views} vues (1000 vues = 1 MANAS)`,
      { viewsCount: views, manasEarned: newManas },
    );

    return {
      success: true,
      message: `+${newManas} MANAS pour ${views} vues`,
      balance: result.balance,
      views,
      manasEarned: newManas,
    };
  }

  // ============================================
  // ✅ ACTIONS QUI GAGNENT DES MANAS
  // ============================================

  // 📖 Lecture d'un chapitre (max 10/jour)
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

  // 🎁 Bonus quotidien (1 MANAS tous les 2 jours)
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
