import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventRankingService } from './event-ranking.service';
import { EventRewardsService } from './event-rewards.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventProgressService } from './event-progress.service';
import { SubmitEventDto } from './dto/submit-event.dto';
import { VoteEventDto } from './dto/vote-event.dto';
import { VoteType } from '@prisma/client'; // ✅ AJOUTER CET IMPORT

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private rankingService: EventRankingService,
    private rewardsService: EventRewardsService,
    private notificationsService: NotificationsService,
    private progressService: EventProgressService,
  ) {}

  // ============================================
  // CRÉER UN ÉVÉNEMENT (ADMIN)
  // ============================================
  async createEvent(adminId: string, dto: CreateEventDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Format de date invalide. Utilisez ISO-8601.');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('La date de début doit être avant la date de fin');
    }

    const overlapping = await this.prisma.event.findFirst({
      where: {
        isActive: true,
        OR: [
          { startDate: { lte: endDate, gte: startDate } },
          { endDate: { lte: endDate, gte: startDate } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Un événement est déjà actif pendant cette période',
      );
    }

    return this.prisma.event.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description || null,
        theme: dto.theme || null,
        icon: dto.icon || null,
        coverUrl: dto.coverUrl || null,
        startDate: startDate,
        endDate: endDate,
        config: dto.config || {},
        rewards: dto.rewards || [],
        objectives: dto.objectives || [],
        isActive: true,
      },
    });
  }

  // ============================================
  // LISTE DES ÉVÉNEMENTS
  // ============================================
  async getEvents(userId?: string, filter?: 'all' | 'active' | 'upcoming' | 'past') {
    const now = new Date();
    let where: any = {};

    if (filter === 'active') {
      where = {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      };
    } else if (filter === 'upcoming') {
      where = {
        isActive: true,
        startDate: { gt: now },
      };
    } else if (filter === 'past') {
      where = {
        OR: [{ isActive: false }, { endDate: { lt: now } }],
      };
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        _count: {
          select: {
            participations: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    if (userId) {
      const participations = await this.prisma.eventParticipation.findMany({
        where: {
          userId,
          eventId: { in: events.map((e) => e.id) },
        },
      });

      return events.map((event) => ({
        ...event,
        userParticipation: participations.find(
          (p) => p.eventId === event.id,
        ),
      }));
    }

    return events;
  }

  // ============================================
  // RÉCUPÉRER UN ÉVÉNEMENT PAR ID
  // ============================================
  async getEventById(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            participations: true,
            submissions: true,
          },
        },
        submissions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            manga: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
              },
            },
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    let userParticipation = null;
    if (userId) {
      userParticipation = await this.prisma.eventParticipation.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      });
    }

    let userProgress = null;
    if (userId && userParticipation) {
      userProgress = await this.progressService.getUserProgress(userId, eventId);
    }

    return {
      ...event,
      userParticipation,
      userProgress,
    };
  }

  // ============================================
  // PARTICIPER À UN ÉVÉNEMENT
  // ============================================
  async joinEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    const now = new Date();
    if (now < event.startDate) {
      throw new BadRequestException('Cet événement n\'a pas encore commencé');
    }
    if (now > event.endDate) {
      throw new BadRequestException('Cet événement est terminé');
    }

    const existing = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Vous participez déjà à cet événement');
    }

    const config = event.config as any || {};
    const maxParticipants = config.maxParticipants || 999999;
    const currentParticipants = await this.prisma.eventParticipation.count({
      where: { eventId },
    });

    if (currentParticipants >= maxParticipants) {
      throw new BadRequestException('Cet événement est complet');
    }

    const participation = await this.prisma.eventParticipation.create({
      data: {
        userId,
        eventId,
        progress: {},
      },
    });

    await this.notificationsService.create({
      userId,
      type: 'SYSTEM',
      title: '🎉 Participation confirmée !',
      body: `Vous participez maintenant à l'événement "${event.title}"`,
      link: `/events/${eventId}`,
      metadata: { eventId },
    });

    return participation;
  }

  // ============================================
  // SOUMETTRE UNE ŒUVRE À UN ÉVÉNEMENT
  // ============================================
  async submitToEvent(
    userId: string,
    eventId: string,
    dto: SubmitEventDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    const allowedTypes = ['BATTLE', 'DESSIN', 'TOURNAMENT'];
    if (!allowedTypes.includes(event.type)) {
      throw new BadRequestException(
        `Cet événement (${event.type}) n'accepte pas de soumissions`,
      );
    }

    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!participation) {
      throw new BadRequestException(
        'Vous devez participer à l\'événement pour soumettre une œuvre',
      );
    }

    const existing = await this.prisma.eventSubmission.findFirst({
      where: {
        eventId,
        userId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà soumis une œuvre à cet événement',
      );
    }

    const submission = await this.prisma.eventSubmission.create({
      data: {
        userId,
        eventId,
        participationId: participation.id,
        mangaId: dto.mangaId,
        chapterId: dto.chapterId,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        status: 'PENDING',
      },
    });

    await this.progressService.updateProgress(userId, eventId, 'SUBMIT', 1);

    return submission;
  }

  // ============================================
  // VOTER POUR UNE SOUMISSION
  // ============================================
  async voteForSubmission(
    userId: string,
    eventId: string,
    dto: VoteEventDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    const allowedTypes = ['BATTLE', 'DESSIN', 'AWARDS'];
    if (!allowedTypes.includes(event.type)) {
      throw new BadRequestException(
        `Cet événement (${event.type}) n'accepte pas de votes`,
      );
    }

    const submission = await this.prisma.eventSubmission.findUnique({
      where: { id: dto.submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Soumission non trouvée');
    }

    if (submission.eventId !== eventId) {
      throw new BadRequestException('Cette soumission ne fait pas partie de cet événement');
    }

    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!participation) {
      throw new BadRequestException(
        'Vous devez participer à l\'événement pour voter',
      );
    }

    if (submission.userId === userId) {
      throw new BadRequestException('Vous ne pouvez pas voter pour votre propre soumission');
    }

    const existingVote = await this.prisma.eventVote.findFirst({
      where: {
        userId,
        eventId,
        participationId: submission.participationId,
      },
    });

    if (existingVote) {
      throw new BadRequestException('Vous avez déjà voté pour cette soumission');
    }

    // ✅ CORRECTION : Utiliser l'enum VoteType de Prisma
    const vote = await this.prisma.eventVote.create({
      data: {
        userId,
        eventId,
        participationId: submission.participationId,
        voteType: dto.voteType, // ✅ Maintenant compatible
      },
    });

    // Mettre à jour le score de la soumission
    let scoreIncrement = 0;
    switch (dto.voteType) {
      case VoteType.UP:
        scoreIncrement = 1;
        break;
      case VoteType.DOWN:
        scoreIncrement = -1;
        break;
      case VoteType.STAR_1:
      case VoteType.STAR_2:
      case VoteType.STAR_3:
      case VoteType.STAR_4:
      case VoteType.STAR_5:
        scoreIncrement = parseInt(dto.voteType.split('_')[1]);
        break;
      default:
        scoreIncrement = 0;
    }

    await this.prisma.eventSubmission.update({
      where: { id: submission.id },
      data: {
        score: submission.score + scoreIncrement,
      },
    });

    if (scoreIncrement > 0) {
      await this.progressService.updateProgress(
        submission.userId,
        eventId,
        'VOTE_RECEIVED',
        1,
      );
    }

    await this.progressService.updateProgress(userId, eventId, 'VOTE_GIVEN', 1);

    return vote;
  }

  // ============================================
  // RÉCLAMER LES RÉCOMPENSES
  // ============================================
  async claimRewards(userId: string, eventId: string) {
    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: {
        event: true,
      },
    });

    if (!participation) {
      throw new BadRequestException('Vous ne participez pas à cet événement');
    }

    if (!participation.isCompleted) {
      throw new BadRequestException(
        'Vous n\'avez pas encore terminé les objectifs de cet événement',
      );
    }

    if (participation.rewardClaimed) {
      throw new BadRequestException('Vous avez déjà réclamé vos récompenses');
    }

    return this.rewardsService.distributeRewards(participation);
  }

  // ============================================
  // RÉCUPÉRER LE CLASSEMENT
  // ============================================
  async getRanking(eventId: string, limit: number = 20) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    let rankings = await this.prisma.eventRanking.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
            badgeColor: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    if (rankings.length === 0) {
      const generated = await this.rankingService.generateRanking(eventId);
      return generated.map((item) => ({
        ...item,
        user: item.user || null,
      }));
    }

    return rankings;
  }

  // ============================================
  // RÉCUPÉRER LA PROGRESSION DE L'UTILISATEUR
  // ============================================
  async getUserEventProgress(userId: string, eventId: string) {
    return this.progressService.getUserProgress(userId, eventId);
  }

  // ============================================
  // METTRE À JOUR UN ÉVÉNEMENT (ADMIN)
  // ============================================
  async updateEvent(adminId: string, eventId: string, dto: UpdateEventDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    const data: any = {
      title: dto.title,
      description: dto.description,
      theme: dto.theme,
      icon: dto.icon,
      coverUrl: dto.coverUrl,
      config: dto.config || undefined,
      rewards: dto.rewards || undefined,
      objectives: dto.objectives || undefined,
      isActive: dto.isActive !== undefined ? dto.isActive : undefined,
    };

    if (dto.startDate) {
      const startDate = new Date(dto.startDate);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException('Format de date de début invalide');
      }
      data.startDate = startDate;
    }

    if (dto.endDate) {
      const endDate = new Date(dto.endDate);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Format de date de fin invalide');
      }
      data.endDate = endDate;
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data,
    });
  }

  // ============================================
  // SUPPRIMER UN ÉVÉNEMENT (ADMIN)
  // ============================================
  async deleteEvent(adminId: string, eventId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    await this.prisma.$transaction([
      this.prisma.eventVote.deleteMany({ where: { eventId } }),
      this.prisma.eventSubmission.deleteMany({ where: { eventId } }),
      this.prisma.eventParticipation.deleteMany({ where: { eventId } }),
      this.prisma.eventRanking.deleteMany({ where: { eventId } }),
      this.prisma.event.delete({ where: { id: eventId } }),
    ]);

    return { success: true, message: 'Événement supprimé avec succès' };
  }

  // ============================================
  // RÉCUPÉRER LES PARTICIPANTS D'UN ÉVÉNEMENT
  // ============================================
  async getParticipants(eventId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      this.prisma.eventParticipation.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              isCertified: true,
              badgeColor: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { joinedAt: 'desc' },
      }),
      this.prisma.eventParticipation.count({ where: { eventId } }),
    ]);

    return {
      data: participants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // METTRE À JOUR LA PROGRESSION D'UN PARTICIPANT
  // ============================================
  async updateProgress(userId: string, eventId: string, progress: any) {
    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!participation) {
      throw new NotFoundException('Participation non trouvée');
    }

    const updated = await this.prisma.eventParticipation.update({
      where: { id: participation.id },
      data: {
        progress,
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    return updated;
  }
}
