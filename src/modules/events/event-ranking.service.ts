import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventRankingService {
  constructor(private prisma: PrismaService) {}

  async generateRanking(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participations: {
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
            votesReceived: true,
          },
        },
      },
    });

    if (!event) {
      throw new Error('Événement non trouvé');
    }

    await this.prisma.eventRanking.deleteMany({
      where: { eventId },
    });

    const rankings = event.participations.map((participation) => {
      const voteScore = participation.votesReceived.reduce(
        (sum, vote) => sum + (vote.weight || 1),
        0,
      );

      return {
        eventId,
        userId: participation.userId,
        participationId: participation.id,
        score: voteScore * 10,
        rank: 0, // Sera mis à jour après le tri
        metrics: {
          votes: voteScore,
        },
        user: participation.user,
      };
    });

    rankings.sort((a, b) => b.score - a.score);

    const ranked = rankings.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    // Sauvegarder les classements
    for (const item of ranked) {
      await this.prisma.eventRanking.create({
        data: {
          eventId: item.eventId,
          userId: item.userId,
          participationId: item.participationId,
          score: item.score,
          rank: item.rank,
          metrics: item.metrics,
        },
      });
    }

    return ranked;
  }
}
