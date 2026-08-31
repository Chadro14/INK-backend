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

  @Cron(CronExpression.EVERY_HOUR)
  async checkEvents() {
    this.logger.log('🔄 Vérification des événements...');

    const now = new Date();

    const startingEvents = await this.prisma.event.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    for (const event of startingEvents) {
      const config = (event.config as any) || {};
      if (!config.started) {
        await this.startEvent(event);
      }
    }

    const endingEvents = await this.prisma.event.findMany({
      where: {
        isActive: true,
        endDate: { lte: now },
      },
    });

    for (const event of endingEvents) {
      const config = (event.config as any) || {};
      if (!config.ended) {
        await this.endEvent(event);
      }
    }
  }

  private async startEvent(event: any) {
    this.logger.log(`🚀 Démarrage de l'événement ${event.id}`);

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        config: { started: true },
      },
    });

    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await this.notificationsService.create({
        userId: user.id,
        type: 'EVENT_STARTED',
        title: '🚀 Un nouvel événement commence !',
        body: `L'événement "${event.title}" vient de commencer. Participe maintenant !`,
        link: `/events/${event.id}`,
        metadata: { eventId: event.id },
      });
    }

    this.logger.log(`✅ Événement ${event.id} démarré`);
  }

  private async endEvent(event: any) {
    this.logger.log(`🏁 Fin de l'événement ${event.id}`);

    await this.rewardsService.distributeEventEndRewards(event.id);

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        isActive: false,
        config: { ended: true },
      },
    });

    const participants = await this.prisma.eventParticipation.findMany({
      where: { eventId: event.id },
    });

    for (const participant of participants) {
      await this.notificationsService.create({
        userId: participant.userId,
        type: 'EVENT_ENDED',
        title: '🏁 L\'événement est terminé !',
        body: `L'événement "${event.title}" est terminé. Vérifie tes récompenses !`,
        link: `/events/${event.id}`,
        metadata: { eventId: event.id },
      });
    }

    this.logger.log(`✅ Événement ${event.id} terminé`);
  }

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
      });

      for (const participant of participants) {
        await this.notificationsService.create({
          userId: participant.userId,
          type: 'EVENT_REMINDER',
          title: '⏰ L\'événement se termine demain !',
          body: `L'événement "${event.title}" se termine demain. N'oublie pas de finaliser ta participation !`,
          link: `/events/${event.id}`,
          metadata: { eventId: event.id },
        });
      }
    }
  }
}
