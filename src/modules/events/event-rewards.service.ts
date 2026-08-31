import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasService } from '../manas/manas.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventRewardsService {
  constructor(
    private prisma: PrismaService,
    private manasService: ManasService,
    private ticketsService: TicketsService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // DISTRIBUER LES RÉCOMPENSES
  // ============================================
  async distributeRewards(participation: any) {
    const { userId, eventId, event } = participation;

    const rewards = event.rewards || [];

    if (rewards.length === 0) {
      throw new BadRequestException('Aucune récompense disponible');
    }

    const results = [];

    for (const reward of rewards) {
      let result;

      switch (reward.type) {
        case 'MANAS':
          result = await this.manasService.addManas(
            userId,
            reward.value,
            `Récompense événement : ${event.title}`,
            'EVENT_REWARD',
            { eventId },
          );
          break;

        case 'TICKET':
          result = await this.ticketsService.addTickets(
            userId,
            reward.value,
            `Ticket gagné via l'événement : ${event.title}`,
            'EVENT_REWARD',
            { eventId },
          );
          break;

        default:
          continue;
      }

      results.push({
        type: reward.type,
        value: reward.value,
        label: reward.label,
        result,
      });
    }

    await this.prisma.eventParticipation.update({
      where: { id: participation.id },
      data: { rewardClaimed: true },
    });

    // Envoyer une notification
    await this.notificationsService.create({
      userId,
      type: 'EVENT_REWARD',
      title: '🎉 Récompenses de l\'événement !',
      body: `Vous avez reçu vos récompenses pour l'événement "${event.title}"`,
      link: `/events/${eventId}`,
      metadata: { results, eventId },
    });

    return {
      success: true,
      message: 'Récompenses distribuées avec succès',
      results,
    };
  }

  // ============================================
  // DISTRIBUER LES RÉCOMPENSES DE FIN D'ÉVÉNEMENT
  // ============================================
  async distributeEventEndRewards(eventId: string) {
    const rankings = await this.prisma.eventParticipation.findMany({
      where: { eventId },
      orderBy: { score: 'desc' },
      take: 3,
      include: {
        user: true,
        event: true,
      },
    });

    const results = [];

    for (const ranking of rankings) {
      const rewardValue = ranking.score === rankings[0]?.score ? 500 : 300;
      const rewardLabel =
        ranking.score === rankings[0]?.score
          ? '🥇 500 MANAS'
          : ranking.score === rankings[1]?.score
          ? '🥈 300 MANAS'
          : '🥉 100 MANAS';

      const reward = {
        type: 'MANAS',
        value: rewardValue,
        label: rewardLabel,
      };

      const result = await this.distributeRewards({
        userId: ranking.userId,
        eventId,
        event: ranking.event,
        rewards: [reward],
        id: ranking.id,
      });

      results.push({
        rank: rankings.indexOf(ranking) + 1,
        userId: ranking.userId,
        result,
      });
    }

    return results;
  }
}
