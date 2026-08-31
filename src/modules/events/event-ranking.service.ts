import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventRankingService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GÉNÉRER LE CLASSEMENT
  // ============================================
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

    // Supprimer les anciens classements
    await this.prisma.eventRanking.deleteMany({
      where: { eventId },
    });

    // Calculer les scores et créer les classements
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
        metrics: {
          votes: voteScore,
        },
      };
    });

    // Trier par score décroissant
    rankings.sort((a, b) => b.score - a.score);

    // Attribuer les rangs
    const ranked = rankings.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    // Sauvegarder les classements
    await this.prisma.eventRanking.createMany({
      data: ranked,
    });

    return ranked;
  }
}
