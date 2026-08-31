import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRewardsService } from './event-rewards.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventSchedulerService {
  private readonly logger = new Logger(EventSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private rewardsService: EventRewardsService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // VÉRIFIER LES ÉVÉNEMENTS TOUTES LES HEURES
  // ============================================
  @Cron(CronExpression.EVERY_HOUR)
  async checkEvents() {
    this.logger.log('🔄 Vérification des événements...');

    const now = new Date();

    // 1. Démarrer les événements qui commencent
    const startingEvents = await this.prisma.event.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        config: { path: ['started'], equals: false },
      },
    });

    for (const event of startingEvents) {
      await this.startEvent(event.id);
    }

    // 2. Terminer les événements qui finissent
    const endingEvents = await this.prisma.event.findMany({
      where: {
        isActive: true,
        endDate: { lte: now },
        config: { path: ['ended'], equals: false },
      },
    });

    for (const event of endingEvents) {
      await this.endEvent(event.id);
    }
  }

  // ============================================
  // DÉMARRER UN ÉVÉNEMENT
  // ============================================
  private async startEvent(eventId: string) {
    this.logger.log(`🚀 Démarrage de l'événement ${eventId}`);

    // Mettre à jour le statut
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        config: { started: true },
      },
    });

    // Notifier les utilisateurs
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await this.notificationsService.createNotification({
        userId: user.id,
        type: 'EVENT_STARTED',
        title: '🚀 Un nouvel événement commence !',
        body: `L'événement "${event.title}" vient de commencer. Participe maintenant !`,
        metadata: { eventId },
      });
    }

    this.logger.log(`✅ Événement ${eventId} démarré`);
  }

  // ============================================
  // TERMINER UN ÉVÉNEMENT
  // ============================================
  private async endEvent(eventId: string) {
    this.logger.log(`🏁 Fin de l'événement ${eventId}`);

    // Récupérer l'événement
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) return;

    // Distribuer les récompenses aux gagnants
    await this.rewardsService.distributeEventEndRewards(eventId);

    // Mettre à jour le statut
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        isActive: false,
        config: { ended: true },
      },
    });

    // Notifier les participants
    const participants = await this.prisma.eventParticipation.findMany({
      where: { eventId },
      include: { user: true },
    });

    for (const participant of participants) {
      await this.notificationsService.createNotification({
        userId: participant.userId,
        type: 'EVENT_ENDED',
        title: '🏁 L\'événement est terminé !',
        body: `L'événement "${event.title}" est terminé. Vérifie tes récompenses !`,
        metadata: { eventId },
      });
    }

    this.logger.log(`✅ Événement ${eventId} terminé`);
  }

  // ============================================
  // RAPPEL 24H AVANT LA FIN
  // ============================================
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async sendReminders() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endingEvents = await this.prisma.event.findMany({
      where: {
        isActive: true,
        endDate: { lte: tomorrow, gte: now },
      },
    });

    for (const event of endingEvents) {
      const participants = await this.prisma.eventParticipation.findMany({
        where: { eventId: event.id },
        include: { user: true },
      });

      for (const participant of participants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          type: 'EVENT_REMINDER',
          title: '⏰ L\'événement se termine demain !',
          body: `L'événement "${event.title}" se termine demain. N'oublie pas de finaliser ta participation !`,
          metadata: { eventId: event.id },
        });
      }
    }
  }
}
