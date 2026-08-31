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

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private rankingService: EventRankingService,
  ) {}

  async createEvent(adminId: string, dto: CreateEventDto) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    return this.prisma.event.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description || null,
        theme: dto.theme || null,
        icon: dto.icon || null,
        coverUrl: dto.coverUrl || null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        config: dto.config || {},
        isActive: true,
      },
    });
  }

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

    return this.prisma.event.findMany({
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
  }

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

    return { ...event, userParticipation };
  }

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

    return this.prisma.eventParticipation.create({
      data: {
        userId,
        eventId,
        progress: {},
      },
    });
  }

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
      rankings = await this.rankingService.generateRanking(eventId);
    }

    return rankings;
  }

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
}
