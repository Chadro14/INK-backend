import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketType } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RÉCUPÉRER LE SOLDE DE TICKETS
  // ============================================
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, premiumActive: true, premiumExpires: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    let ticket = await this.prisma.ticket.findUnique({
      where: { userId },
    });

    if (!ticket) {
      ticket = await this.prisma.ticket.create({
        data: { userId, amount: 0 },
      });
    }

    const hasUnlimitedTickets = user.premiumActive && user.premiumExpires && user.premiumExpires > new Date();

    return {
      username: user.username,
      tickets: ticket.amount,
      hasUnlimitedTickets,
      isPremium: hasUnlimitedTickets,
      premiumExpires: user.premiumExpires,
    };
  }

  // ============================================
  // AJOUTER DES TICKETS
  // ============================================
  async addTickets(
    userId: string,
    amount: number,
    type: TicketType,
    description: string,
    metadata?: any,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    let ticket = await this.prisma.ticket.findUnique({
      where: { userId },
    });

    if (!ticket) {
      ticket = await this.prisma.ticket.create({
        data: { userId, amount: 0 },
      });
    }

    const [updatedTicket, transaction] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { amount: { increment: amount } },
      }),
      this.prisma.ticketTransaction.create({
        data: {
          userId,
          ticketId: ticket.id,
          amount,
          type,
          description,
          metadata: metadata || null,
        },
      }),
    ]);

    return {
      success: true,
      tickets: updatedTicket.amount,
      transaction,
    };
  }

  // ============================================
  // UTILISER UN TICKET (AVEC VÉRIFICATION PREMIUM)
  // ============================================
  async useTicket(userId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { manga: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    // Vérifier si déjà débloqué
    const existingUse = await this.prisma.ticketUse.findUnique({
      where: {
        userId_chapterId: { userId, chapterId },
      },
    });

    if (existingUse) {
      throw new BadRequestException('Chapitre déjà débloqué avec un ticket');
    }

    // ✅ VÉRIFIER SI L'UTILISATEUR EST PREMIUM (TICKETS ILLIMITÉS)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumActive: true, premiumExpires: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // ✅ SI PREMIUM ACTIF → TICKETS ILLIMITÉS
    const isPremiumActive = user.premiumActive && user.premiumExpires && user.premiumExpires > new Date();

    if (isPremiumActive) {
      // Enregistrer l'utilisation (sans consommer de ticket)
      await this.prisma.ticketUse.create({
        data: {
          userId,
          ticketId: null, // Pas de ticket consommé
          chapterId: chapter.id,
          mangaId: chapter.mangaId,
        },
      });

      // Enregistrer une transaction pour le suivi
      await this.prisma.ticketTransaction.create({
        data: {
          userId,
          ticketId: null,
          amount: 0,
          type: 'GIFT',
          description: `Déblocage Premium du chapitre ${chapter.number} (tickets illimités)`,
          metadata: { chapterId, mangaId: chapter.mangaId, method: 'premium_unlimited' },
        },
      });

      return {
        success: true,
        message: `Chapitre ${chapter.number} débloqué (Premium - tickets illimités)`,
        remainingTickets: 'illimité',
        isPremium: true,
        chapter: {
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          manga: chapter.manga.title,
        },
      };
    }

    // ✅ SI PAS PREMIUM → VÉRIFIER LE SOLDE DE TICKETS
    const ticket = await this.prisma.ticket.findUnique({
      where: { userId },
    });

    if (!ticket || ticket.amount < 1) {
      throw new BadRequestException('Vous n\'avez pas assez de tickets');
    }

    // Consommer 1 ticket
    const [updatedTicket, transaction, use] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { amount: { decrement: 1 } },
      }),
      this.prisma.ticketTransaction.create({
        data: {
          userId,
          ticketId: ticket.id,
          amount: -1,
          type: TicketType.USED,
          description: `Déblocage du chapitre ${chapter.number}`,
          metadata: { chapterId, mangaId: chapter.mangaId },
        },
      }),
      this.prisma.ticketUse.create({
        data: {
          userId,
          ticketId: ticket.id,
          chapterId: chapter.id,
          mangaId: chapter.mangaId,
        },
      }),
    ]);

    return {
      success: true,
      message: `Chapitre ${chapter.number} débloqué avec succès`,
      remainingTickets: updatedTicket.amount,
      isPremium: false,
      chapter: {
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        manga: chapter.manga.title,
      },
    };
  }

  // ============================================
  // ✅ RÉCOMPENSE QUOTIDIENNE (1 TICKET TOUS LES 2 JOURS)
  // ============================================
  async claimDailyReward(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier si l'utilisateur a déjà réclamé dans les 48h
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

    const existingClaim = await this.prisma.ticketTransaction.findFirst({
      where: {
        userId,
        type: TicketType.DAILY_REWARD,
        createdAt: { gte: twoDaysAgo },
      },
    });

    if (existingClaim) {
      const timeLeft = 48 - Math.floor((Date.now() - existingClaim.createdAt.getTime()) / (1000 * 60 * 60));
      throw new BadRequestException(`Ticket déjà réclamé. Prochain dans ${timeLeft}h`);
    }

    // Ajouter 1 ticket
    return this.addTickets(
      userId,
      1,
      TicketType.DAILY_REWARD,
      'Ticket gratuit (récompense 48h)',
      { date: new Date().toISOString() },
    );
  }

  // ============================================
  // TICKET DE PARRAINAGE
  // ============================================
  async referralTicket(referrerId: string, newUserId: string) {
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
      select: { createdAt: true },
    });

    if (!newUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const hoursSinceCreation = (Date.now() - newUser.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException('Le parrainage doit être effectué dans les 24h suivant l\'inscription');
    }

    const existing = await this.prisma.ticketTransaction.findFirst({
      where: {
        userId: referrerId,
        type: TicketType.REFERRAL,
        metadata: { path: ['newUserId'], equals: newUserId },
      },
    });

    if (existing) {
      throw new BadRequestException('Vous avez déjà été récompensé pour ce parrainage');
    }

    return this.addTickets(
      referrerId,
      1,
      TicketType.REFERRAL,
      `Parrainage de ${newUserId}`,
      { newUserId },
    );
  }

  // ============================================
  // TICKET D'ÉVÉNEMENT
  // ============================================
  async claimEventTicket(userId: string, eventId: string) {
    const event = await this.prisma.ticketEvent.findUnique({
      where: { id: eventId, isActive: true },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé ou inactif');
    }

    const now = new Date();
    if (now < event.startDate || now > event.endDate) {
      throw new BadRequestException('Cet événement n\'est pas en cours');
    }

    const existing = await this.prisma.ticketParticipation.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existing) {
      throw new BadRequestException('Vous avez déjà participé à cet événement');
    }

    const result = await this.addTickets(
      userId,
      event.tickets,
      TicketType.EVENT,
      `Ticket événement : ${event.name}`,
      { eventId, eventName: event.name },
    );

    await this.prisma.ticketParticipation.create({
      data: {
        userId,
        eventId,
        ticketId: result.transaction.ticketId,
      },
    });

    return {
      success: true,
      message: `${event.tickets} tickets gagnés pour l'événement ${event.name}`,
      tickets: result.tickets,
    };
  }

  // ============================================
  // HISTORIQUE DES TICKETS
  // ============================================
  async getHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.ticketTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketTransaction.count({ where: { userId } }),
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
  // LISTE DES ÉVÉNEMENTS DISPONIBLES
  // ============================================
  async getActiveEvents() {
    const now = new Date();
    return this.prisma.ticketEvent.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'asc' },
    });
  }
}
