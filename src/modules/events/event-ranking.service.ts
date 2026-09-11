import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventRankingService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GÉNÉRER LE CLASSEMENT D'UN ÉVÉNEMENT
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
                avatarColor: true,
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

    // Supprimer l'ancien classement
    await this.prisma.eventRanking.deleteMany({
      where: { eventId },
    });

    // Calculer le score pour chaque participation
    const rankings = event.participations.map((participation) => {
      const votesReceived = participation.votesReceived || [];
      const totalVotes = votesReceived.length;

      // Score pondéré = somme des poids (ou 1 par vote par défaut)
      const weightedScore = votesReceived.reduce(
        (sum, vote) => sum + (vote.weight || 1),
        0,
      );

      return {
        eventId,
        userId: participation.userId,
        participationId: participation.id,
        score: weightedScore,
        rank: 0,
        metrics: {
          votes: totalVotes,           // ✅ Nombre de votes
          weightedScore: weightedScore, // ✅ Score pondéré
        },
        user: participation.user,
      };
    });

    // Trier par score décroissant
    rankings.sort((a, b) => b.score - a.score);

    // Assigner le rang
    const ranked = rankings.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    // Sauvegarder les classements
    const savedRankings = [];
    for (const item of ranked) {
      const saved = await this.prisma.eventRanking.create({
        data: {
          eventId: item.eventId,
          userId: item.userId,
          participationId: item.participationId,
          score: item.score,
          rank: item.rank,
          metrics: item.metrics,
        },
      });
      savedRankings.push({
        ...saved,
        user: item.user,
      });
    }

    return savedRankings;
  }
}
