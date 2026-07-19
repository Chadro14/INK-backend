import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRÉER UN ÉVÉNEMENT (admin)
  // ============================================
  async createEvent(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        theme: dto.theme,
        icon: dto.icon || '🎯',
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        objectives: dto.objectives || [],
        rewards: dto.rewards || [],
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  // ============================================
  // LISTE DES ÉVÉNEMENTS ACTIFS
  // ============================================
  async getActiveEvents() {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'asc' },
    });
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
    if (event.startDate > now || event.endDate < now) {
      throw new BadRequestException('Cet événement n\'est pas actif');
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

    return this.prisma.eventParticipation.create({
      data: {
        userId,
        eventId,
        progress: {},
        isCompleted: false,
      },
    });
  }

  // ============================================
  // METTRE À JOUR LA PROGRESSION
  // ============================================
  async updateProgress(userId: string, eventId: string, action: string, value: number = 1) {
    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: { event: true },
    });

    if (!participation) {
      throw new NotFoundException('Participation non trouvée');
    }

    const progress = participation.progress as Record<string, number> || {};
    progress[action] = (progress[action] || 0) + value;

    const objectives = participation.event.objectives as Array<{
      type: string;
      target: number;
      reward: string;
    }> || [];

    const isCompleted = objectives.every((obj) => (progress[obj.type] || 0) >= obj.target);

    return this.prisma.eventParticipation.update({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      data: {
        progress,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  // ============================================
  // RÉCUPÉRER LA PROGRESSION D'UN UTILISATEUR
  // ============================================
  async getUserProgress(userId: string, eventId: string) {
    const participation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: { event: true },
    });

    if (!participation) {
      throw new NotFoundException('Participation non trouvée');
    }

    return {
      event: participation.event,
      progress: participation.progress,
      isCompleted: participation.isCompleted,
      completedAt: participation.completedAt,
    };
  }

  // ============================================
  // NETTOYAGE AUTO (Cron)
  // ============================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanExpiredEvents() {
    const now = new Date();
    await this.prisma.event.updateMany({
      where: {
        endDate: { lt: now },
        isActive: true,
      },
      data: { isActive: false },
    });
  }
}