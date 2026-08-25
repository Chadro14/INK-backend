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
      select: { manas: true, username: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      balance: user.manas,
      username: user.username,
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

    // Vérifier que le destinataire existe
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, username: true },
    });

    if (!receiver) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Débiter l'expéditeur
    await this.spendManas(
      senderId,
      amount,
      ManasTransactionType.GIFT_SENT,
      `Envoi de ${amount} MANAS à ${receiver.username}`,
      { receiverId, receiverUsername: receiver.username },
    );

    // Créditer le destinataire
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
  // ACTIONS QUI GAGNENT DES MANAS
  // ============================================

  // 📖 Lecture d'un chapitre
  async onChapterRead(userId: string, chapterId: string, mangaId: string) {
    return this.addManas(
      userId,
      1,
      ManasTransactionType.READING,
      'Lecture d\'un chapitre',
      { chapterId, mangaId },
    );
  }

  // ❤️ Like reçu sur un manga (pour le créateur)
  async onLikeReceived(userId: string, mangaId: string) {
    return this.addManas(
      userId,
      2,
      ManasTransactionType.LIKE_RECEIVED,
      'Like reçu sur votre manga',
      { mangaId },
    );
  }

  // 💬 Commentaire reçu (pour le créateur)
  async onCommentReceived(userId: string, mangaId: string) {
    return this.addManas(
      userId,
      3,
      ManasTransactionType.COMMENT_RECEIVED,
      'Commentaire reçu sur votre manga',
      { mangaId },
    );
  }

  // 👥 Nouvel abonné (pour le créateur)
  async onNewSubscriber(userId: string, followerId: string) {
    return this.addManas(
      userId,
      5,
      ManasTransactionType.SUBSCRIBER,
      'Nouvel abonné',
      { followerId },
    );
  }

  // 🎁 Bonus quotidien (1 MANAS tous les 2 jours)
  async dailyBonus(userId: string) {
    // Vérifier si le bonus a déjà été réclamé aujourd'hui
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

    // TODO: Créer une entrée dans une table "UserChapterPurchase" pour suivre les achats

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

    if (creator.role !== 'CREATOR') {
      throw new BadRequestException('Cet utilisateur n\'est pas un créateur');
    }

    // Dépenser les MANAS
    const result = await this.spendManas(
      userId,
      amountInManas,
      ManasTransactionType.COLLABORATION,
      `Collaboration avec ${creator.username}`,
      { creatorId, creatorUsername: creator.username },
    );

    // Créditer le créateur (ou lui envoyer une notification)
    await this.addManas(
      creatorId,
      amountInManas * 0.7, // Le créateur reçoit 70%
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
