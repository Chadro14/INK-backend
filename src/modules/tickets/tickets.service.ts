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

    const hasUnlimitedTickets =
      user.premiumActive &&
      user.premiumExpires &&
      user.premiumExpires > new Date();

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
    description: string,
    type: TicketType,
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
  // UTILISER UN TICKET (ACCÈS 2H)
  // ============================================
  async useTicket(userId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { manga: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    // Anti-auto-achat : l'auteur a toujours accès
    if (chapter.manga.authorId === userId) {
      throw new BadRequestException(
        "Vous êtes l'auteur de ce manga. Vous y avez déjà accès.",
      );
    }

    // Anti-double-achat : si déjà acheté avec MANAS → refuser
    const alreadyBoughtWithManas = await this.prisma.manasTransaction.findFirst({
      where: {
        userId,
        type: 'CHAPTER_PURCHASE',
        metadata: {
          path: ['chapterId'],
          equals: chapterId,
        },
      },
    });

    if (alreadyBoughtWithManas) {
      throw new BadRequestException(
        'Vous avez déjà acheté ce chapitre avec des MANAS. Accès permanent.',
      );
    }

    // Vérifier les utilisations existantes
    const existingUses = await this.prisma.ticketUse.findMany({
      where: { userId, chapterId },
    });

    // Vérifier si Premium
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumActive: true, premiumExpires: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isPremiumActive =
      user.premiumActive &&
      user.premiumExpires &&
      user.premiumExpires > new Date();

    // PREMIUM → accès permanent (expiresAt = null)
    if (isPremiumActive) {
      if (existingUses.length > 0) {
        await this.prisma.ticketUse.update({
          where: { id: existingUses[0].id },
          data: { expiresAt: null } as any,
        });
      } else {
        await this.prisma.ticketUse.create({
          data: {
            userId,
            ticketId: null,
            chapterId: chapter.id,
            mangaId: chapter.mangaId,
            expiresAt: null,
          } as any,
        });
      }

      await this.prisma.ticketTransaction.create({
        data: {
          userId,
          ticketId: null,
          amount: 0,
          type: 'GIFT',
          description: `Déblocage Premium du chapitre ${chapter.number} (tickets illimités)`,
          metadata: {
            chapterId,
            mangaId: chapter.mangaId,
            method: 'premium_unlimited',
          },
        },
      });

      return {
        success: true,
        message: `Chapitre ${chapter.number} débloqué (Premium - tickets illimités)`,
        remainingTickets: 'illimité',
        isPremium: true,
        expiresAt: null,
        chapter: {
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          manga: chapter.manga.title,
        },
      };
    }

    // NON PREMIUM → consommer 1 ticket
    const ticket = await this.prisma.ticket.findUnique({
      where: { userId },
    });

    if (!ticket || ticket.amount < 1) {
      throw new BadRequestException("Vous n'avez pas assez de tickets");
    }

    // Expiration : maintenant + 2h
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const [updatedTicket] = await this.prisma.$transaction([
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
          description: `Déblocage du chapitre ${chapter.number} (2h)`,
          metadata: {
            chapterId,
            mangaId: chapter.mangaId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      }),
    ]);

    // Upsert TicketUse
    if (existingUses.length > 0) {
      await this.prisma.ticketUse.update({
        where: { id: existingUses[0].id },
        data: {
          expiresAt,
          ticketId: ticket.id,
        } as any,
      });
    } else {
      await this.prisma.ticketUse.create({
        data: {
          userId,
          ticketId: ticket.id,
          chapterId: chapter.id,
          mangaId: chapter.mangaId,
          expiresAt,
        } as any,
      });
    }

    return {
      success: true,
      message: `Chapitre ${chapter.number} débloqué pendant 2 heures`,
      remainingTickets: updatedTicket.amount,
      isPremium: false,
      expiresAt: expiresAt.toISOString(),
      chapter: {
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        manga: chapter.manga.title,
      },
    };
  }

  // ============================================
  // RÉCOMPENSE QUOTIDIENNE (1 TICKET TOUS LES 2 JOURS)
  // ============================================
  async claimDailyReward(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

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
      const timeLeft =
        48 -
        Math.floor(
          (Date.now() - existingClaim.createdAt.getTime()) / (1000 * 60 * 60),
        );
      throw new BadRequestException(
        `Ticket déjà réclamé. Prochain dans ${timeLeft}h`,
      );
    }

    return this.addTickets(
      userId,
      1,
      'Ticket gratuit (récompense 48h)',
      TicketType.DAILY_REWARD,
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

    const hoursSinceCreation =
      (Date.now() - newUser.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException(
        "Le parrainage doit être effectué dans les 24h suivant l'inscription",
      );
    }

    const existing = await this.prisma.ticketTransaction.findFirst({
      where: {
        userId: referrerId,
        type: TicketType.REFERRAL,
        metadata: { path: ['newUserId'], equals: newUserId },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà été récompensé pour ce parrainage',
      );
    }

    return this.addTickets(
      referrerId,
      1,
      `Parrainage de ${newUserId}`,
      TicketType.REFERRAL,
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
      throw new BadRequestException("Cet événement n'est pas en cours");
    }

    const existing = await this.prisma.ticketParticipation.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà participé à cet événement',
      );
    }

    const result = await this.addTickets(
      userId,
      event.tickets,
      `Ticket événement : ${event.name}`,
      TicketType.EVENT,
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
    return
