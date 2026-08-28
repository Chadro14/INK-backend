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
      select: { username: true },
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

    return {
      username: user.username,
      tickets: ticket.amount,
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
  // UTILISER UN TICKET
  // ============================================
  async useTicket(userId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { manga: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    // Vérifier si le chapitre est déjà débloqué
    const existingUse = await this.prisma.ticketUse.findUnique({
      where: {
        userId_chapterId: { userId, chapterId },
      },
    });

    if (existingUse) {
      throw new BadRequestException('Chapitre déjà débloqué avec un ticket');
    }

    // Vérifier le solde de tickets
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
      chapter: {
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        manga: chapter.manga.title,
      },
    };
  }

  // ============================================
  // TICKET QUOTIDIEN (LIMITÉ)
  // ============================================
  async claimDailyTicket(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Vérifier si déjà réclamé aujourd'hui
    const existing = await this.prisma.ticketTransaction.findFirst({
      where: {
        userId,
        type: TicketType.DAILY_REWARD,
        createdAt: { gte: today },
      },
    });

    if (existing) {
      throw new BadRequestException('Ticket quotidien déjà réclamé aujourd\'hui');
    }

    // Vérifier la limite hebdomadaire (max 3 tickets par semaine)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyCount = await this.prisma.ticketTransaction.count({
      where: {
        userId,
        type: TicketType.DAILY_REWARD,
        createdAt: { gte: weekAgo },
      },
    });

    if (weeklyCount >= 3) {
      throw new BadRequestException('Limite hebdomadaire de tickets atteinte (3/semaine)');
    }

    // Offrir 1 ticket
    return this.addTickets(
      userId,
      1,
      TicketType.DAILY_REWARD,
      'Ticket quotidien 🎟️',
      { date: new Date().toISOString() },
    );
  }

  // ============================================
  // TICKET DE PARRAINAGE
  // ============================================
  async referralTicket(referrerId: string, newUserId: string) {
    // Vérifier que le parrainé s'est bien inscrit
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
      select: { createdAt: true },
    });

    if (!newUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier que l'inscription date de moins de 24h
    const hoursSinceCreation = (Date.now() - newUser.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException('Le parrainage doit être effectué dans les 24h suivant l\'inscription');
    }

    // Vérifier que le parrain n'a pas déjà été récompensé pour ce nouvel utilisateur
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

    // Offrir 1 ticket
    return this.addTickets(
      referrerId,
      1,
      TicketType.REFERRAL,
      `Parrainage de ${newUserId} 🎟️`,
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

    // Vérifier que l'événement est en cours
    const now = new Date();
    if (now < event.startDate || now > event.endDate) {
      throw new BadRequestException('Cet événement n\'est pas en cours');
    }

    // Vérifier que l'utilisateur n'a pas déjà participé
    const existing = await this.prisma.ticketParticipation.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existing) {
      throw new BadRequestException('Vous avez déjà participé à cet événement');
    }

    // Ajouter les tickets de l'événement
    const result = await this.addTickets(
      userId,
      event.tickets,
      TicketType.EVENT,
      `Ticket événement : ${event.name}`,
      { eventId, eventName: event.name },
    );

    // Enregistrer la participation
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
}
