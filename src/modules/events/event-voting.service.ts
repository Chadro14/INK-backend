import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoteType } from '@prisma/client';

@Injectable()
export class EventVotingService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // VOTER POUR UNE PARTICIPATION
  // ============================================
  async vote(
    userId: string,
    eventId: string,
    participationId: string,
    voteType: VoteType = VoteType.UP,
  ) {
    // Vérifier que l'événement existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    // Vérifier que l'événement est actif
    const now = new Date();
    if (now < event.startDate || now > event.endDate) {
      throw new BadRequestException('Cet événement n\'est pas actif');
    }

    // Vérifier que l'utilisateur participe à l'événement
    const userParticipation = await this.prisma.eventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!userParticipation) {
      throw new BadRequestException(
        'Vous devez participer à l\'événement pour voter',
      );
    }

    // Vérifier que la participation cible existe
    const targetParticipation = await this.prisma.eventParticipation.findUnique({
      where: { id: participationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!targetParticipation) {
      throw new NotFoundException('Participation non trouvée');
    }

    // Ne pas pouvoir voter pour soi-même
    if (targetParticipation.userId === userId) {
      throw new BadRequestException('Vous ne pouvez pas voter pour vous-même');
    }

    // Vérifier si l'utilisateur a déjà voté pour cette participation
    const existingVote = await this.prisma.eventVote.findUnique({
      where: {
        userId_eventId_participationId: {
          userId,
          eventId,
          participationId,
        },
      },
    });

    // Calcul du poids du vote (anti-fraude)
    const weight = await this.calculateVoteWeight(userId);

    if (existingVote) {
      // Mettre à jour le vote
      await this.prisma.eventVote.update({
        where: { id: existingVote.id },
        data: {
          voteType,
          weight,
        },
      });
    } else {
      // Créer le vote
      await this.prisma.eventVote.create({
        data: {
          userId,
          eventId,
          participationId,
          voteType,
          weight,
        },
      });
    }

    // Recalculer le score de la participation
    await this.updateParticipationScore(participationId);

    return { success: true, message: 'Vote enregistré' };
  }

  // ============================================
  // CALCULER LE POIDS DU VOTE (ANTI-FRAUDE)
  // ============================================
  private async calculateVoteWeight(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        email: true,
        isCertified: true,
        role: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
          },
        },
      },
    });

    if (!user) return 1;

    let weight = 1;

    // Compte actif depuis plus de 30 jours
    const daysOld = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysOld > 30) weight += 0.5;
    if (daysOld > 90) weight += 0.5;

    // Email vérifié
    if (user.email) weight += 0.5;

    // Utilisateur certifié
    if (user.isCertified) weight += 1;

    // Créateur avec des mangas
    if (user._count.mangas > 0) weight += 0.5;

    // A des abonnés
    if (user._count.followers > 10) weight += 0.5;

    // Admin → poids maximum
    if (user.role === 'ADMIN') weight = Math.min(weight, 5);

    return Math.min(Math.round(weight * 10) / 10, 5);
  }

  // ============================================
  // METTRE À JOUR LE SCORE D'UNE PARTICIPATION
  // ============================================
  private async updateParticipationScore(participationId: string) {
    const votes = await this.prisma.eventVote.findMany({
      where: { participationId },
      select: { weight: true, voteType: true },
    });

    let score = 0;
    for (const vote of votes) {
      // ✅ CORRECTION : Vérifier correctement les types de vote
      if (this.isPositiveVote(vote.voteType)) {
        score += vote.weight;
      } else if (vote.voteType === VoteType.DOWN) {
        score -= vote.weight;
      }
    }

    // Mettre à jour le score
    await this.prisma.eventParticipation.update({
      where: { id: participationId },
      data: { score },
    });
  }

  // ============================================
  // VÉRIFIER SI UN VOTE EST POSITIF
  // ============================================
  private isPositiveVote(voteType: VoteType): boolean {
    return voteType === VoteType.UP || 
           voteType === VoteType.STAR_1 ||
           voteType === VoteType.STAR_2 ||
           voteType === VoteType.STAR_3 ||
           voteType === VoteType.STAR_4 ||
           voteType === VoteType.STAR_5;
  }

  // ============================================
  // RÉCUPÉRER LES VOTES D'UN ÉVÉNEMENT
  // ============================================
  async getEventVotes(eventId: string) {
    return this.prisma.eventVote.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        participation: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  // ============================================
  // OBTENIR LE POIDS D'UN VOTE
  // ============================================
  getVoteWeight(voteType: VoteType): number {
    switch (voteType) {
      case VoteType.UP:
        return 1;
      case VoteType.DOWN:
        return -1;
      case VoteType.STAR_1:
        return 1;
      case VoteType.STAR_2:
        return 2;
      case VoteType.STAR_3:
        return 3;
      case VoteType.STAR_4:
        return 4;
      case VoteType.STAR_5:
        return 5;
      default:
        return 0;
    }
  }
}
