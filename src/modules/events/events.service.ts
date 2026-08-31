import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventType, VoteType, SubmissionStatus } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventVotingService } from './event-voting.service';
import { EventRewardsService } from './event-rewards.service';
import { EventRankingService } from './event-ranking.service';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private votingService: EventVotingService,
    private rewardsService: EventRewardsService,
    private rankingService: EventRankingService,
  ) {}

  // ============================================
  // CRÉER UN ÉVÉNEMENT
  // ============================================
  async createEvent(adminId: string, dto: CreateEventDto) {
    // Vérifier que l'admin existe
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    // Vérifier qu'il n'y a pas de conflit de dates
    const overlapping = await this.prisma.event.findFirst({
      where: {
        isActive: true,
        OR: [
          { startDate: { lte: dto.endDate, gte: dto.startDate } },
          { endDate: { lte: dto.endDate, gte: dto.startDate } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Un événement est déjà actif pendant cette période'
      );
    }

    return this.prisma.event.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        theme: dto.theme,
        icon: dto.icon,
        coverUrl: dto.coverUrl,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        config: dto.config || {},
        isActive: true,
      },
    });
  }

  // ============================================
  // LISTE DES ÉVÉNEMENTS
  // ============================================
  async getEvents(
    userId?: string,
    filter?: 'all' | 'active' | 'upcoming' | 'past',
  ) {
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

    // Ajouter la participation de l'utilisateur
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
          (p) => p.eventId === event.id
        ),
      }));
    }

    return events;
  }

  // ============================================
  // RÉCUPÉRER UN ÉVÉNÉMENT PAR ID
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

    // Récupérer la participation de l'utilisateur
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

    return {
      ...event,
      userParticipation,
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

    // Vérifier si déjà inscrit
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

    // Vérifier le nombre de participants (si configuré)
    const maxParticipants = event.config?.maxParticipants || 999999;
    const currentParticipants = await this.prisma.eventParticipation.count({
      where: { eventId },
    });

    if (currentParticipants >= maxParticipants) {
      throw new BadRequestException('Cet événement est complet');
    }

    return this.prisma.eventParticipation.create({
      data: {
        userId,
        eventId,
        progress: {},
      },
    });
  }

  // ============================================
  // SOUMETTRE UNE ŒUVRE À UN ÉVÉNEMENT
  // ============================================
  async submitToEvent(
    userId: string,
    eventId: string,
    data: {
      title: string;
      description?: string;
      mangaId?: string;
      chapterId?: string;
      imageUrl?: string;
    },
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    // Vérifier que l'utilisateur participe
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
        'Vous devez participer à l\'événement pour soumettre une œuvre'
      );
    }

    // Vérifier que l'événement accepte les soumissions
    if (event.type === 'TICKETS' || event.type === 'AWARDS') {
      throw new BadRequestException(
        'Cet événement n\'accepte pas de soumissions'
      );
    }

    // Vérifier qu'il n'y a pas déjà une soumission
    const existing = await this.prisma.eventSubmission.findFirst({
      where: {
        eventId,
        userId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Vous avez déjà soumis une œuvre à cet événement'
      );
    }

    return this.prisma.eventSubmission.create({
      data: {
        userId,
        eventId,
        mangaId: data.mangaId,
        chapterId: data.chapterId,
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        status: 'PENDING',
      },
    });
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

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: dto.title,
        description: dto.description,
        theme: dto.theme,
        icon: dto.icon,
        coverUrl: dto.coverUrl,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        config: dto.config || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
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

    // Supprimer toutes les données liées
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
  // RÉCUPÉRER LE CLASSEMENT
  // ============================================
  async getRanking(eventId: string, limit: number = 20) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    // Vérifier si le classement est en cache
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

    // Si le classement est vide, le générer
    if (rankings.length === 0) {
      rankings = await this.rankingService.generateRanking(eventId);
    }

    return rankings;
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
        'Vous n\'avez pas encore terminé les objectifs de cet événement'
      );
    }

    if (participation.rewardClaimed) {
      throw new BadRequestException('Vous avez déjà réclamé vos récompenses');
    }

    return this.rewardsService.distributeRewards(participation);
  }
}
