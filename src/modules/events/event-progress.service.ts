import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventType } from '@prisma/client';

@Injectable()
export class EventProgressService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // METTRE À JOUR LA PROGRESSION D'UN UTILISATEUR
  // ============================================
  async updateProgress(
    userId: string,
    eventId: string,
    action: string,
    value: number = 1,
  ) {
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
      throw new Error('Vous ne participez pas à cet événement');
    }

    const event = participation.event;
    const currentProgress = (participation.progress as any) || {};
    const now = new Date();

    // Vérifier que l'événement est actif
    if (now < event.startDate || now > event.endDate) {
      throw new Error('Cet événement n\'est pas actif');
    }

    // Mettre à jour la progression selon le type d'événement
    let newProgress = { ...currentProgress };

    switch (event.type) {
      case 'BATTLE':
        newProgress = this.updateBattleProgress(currentProgress, action, value);
        break;
      case 'DESSIN':
        newProgress = this.updateDessinProgress(currentProgress, action, value);
        break;
      case 'TICKETS':
        newProgress = this.updateTicketsProgress(currentProgress, action, value);
        break;
      case 'RISING_CREATOR':
        newProgress = this.updateRisingCreatorProgress(currentProgress, action, value);
        break;
      case 'AWARDS':
        newProgress = this.updateAwardsProgress(currentProgress, action, value);
        break;
      case 'TOURNAMENT':
        newProgress = this.updateTournamentProgress(currentProgress, action, value);
        break;
      default:
        throw new Error(`Type d'événement non supporté: ${event.type}`);
    }

    // Vérifier si tous les objectifs sont atteints
    const objectives = event.objectives as any[] || [];
    const isCompleted = this.checkObjectivesCompleted(newProgress, objectives);

    return this.prisma.eventParticipation.update({
      where: { id: participation.id },
      data: {
        progress: newProgress,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  // ============================================
  // PROGRESSION - BATTLE
  // ============================================
  private updateBattleProgress(progress: any, action: string, value: number) {
    switch (action) {
      case 'SUBMIT':
        progress.submissions = (progress.submissions || 0) + value;
        break;
      case 'VOTE_RECEIVED':
        progress.votesReceived = (progress.votesReceived || 0) + value;
        break;
      case 'VOTE_GIVEN':
        progress.votesGiven = (progress.votesGiven || 0) + value;
        break;
    }
    return progress;
  }

  // ============================================
  // PROGRESSION - DESSIN
  // ============================================
  private updateDessinProgress(progress: any, action: string, value: number) {
    switch (action) {
      case 'SUBMIT':
        progress.submissions = (progress.submissions || 0) + value;
        break;
      case 'RATING_RECEIVED':
        progress.ratingsReceived = (progress.ratingsReceived || 0) + value;
        const total = progress.totalRatingScore || 0;
        progress.totalRatingScore = total + value;
        progress.averageRating = progress.totalRatingScore / (progress.ratingsReceived || 1);
        break;
      case 'RATING_GIVEN':
        progress.ratingsGiven = (progress.ratingsGiven || 0) + value;
        break;
    }
    return progress;
  }

  // ============================================
  // PROGRESSION - TICKETS
  // ============================================
  private updateTicketsProgress(progress: any, action: string, value: number) {
    switch (action) {
      case 'READ_CHAPTER':
        progress.chaptersRead = (progress.chaptersRead || 0) + value;
        progress.tickets = (progress.tickets || 0) + value;
        break;
      case 'LIKE':
        progress.likesGiven = (progress.likesGiven || 0) + value;
        progress.tickets = (progress.tickets || 0) + value;
        break;
      case 'COMMENT':
        progress.commentsGiven = (progress.commentsGiven || 0) + value;
        progress.tickets = (progress.tickets || 0) + value;
        break;
      case 'DAILY_BONUS':
        progress.tickets = (progress.tickets || 0) + value;
        break;
    }
    return progress;
  }

  // ============================================
  // PROGRESSION - RISING_CREATOR
  // ============================================
  private updateRisingCreatorProgress(progress: any, action: string, value: number) {
    const now = new Date();
    const startDate = progress.startDate ? new Date(progress.startDate) : now;
    
    switch (action) {
      case 'FOLLOWER_GAINED':
        progress.followersGained = (progress.followersGained || 0) + value;
        progress.currentFollowers = (progress.currentFollowers || 0) + value;
        break;
      case 'LIKE_RECEIVED':
        progress.likesGained = (progress.likesGained || 0) + value;
        break;
      case 'VIEW_RECEIVED':
        progress.viewsGained = (progress.viewsGained || 0) + value;
        break;
      case 'CHAPTER_PUBLISHED':
        progress.chaptersPublished = (progress.chaptersPublished || 0) + value;
        break;
    }
    
    // Calculer le score de progression
    const daysElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) || 1;
    progress.growthRate = ((progress.followersGained || 0) / daysElapsed);
    progress.score = 
      (progress.followersGained || 0) * 10 +
      (progress.likesGained || 0) * 2 +
      (progress.viewsGained || 0) * 0.5 +
      (progress.chaptersPublished || 0) * 50;

    return progress;
  }

  // ============================================
  // PROGRESSION - AWARDS
  // ============================================
  private updateAwardsProgress(progress: any, action: string, value: number) {
    switch (action) {
      case 'NOMINATE':
        progress.nominations = (progress.nominations || 0) + value;
        break;
      case 'VOTE_RECEIVED':
        progress.votesReceived = (progress.votesReceived || 0) + value;
        break;
    }
    return progress;
  }

  // ============================================
  // PROGRESSION - TOURNAMENT
  // ============================================
  private updateTournamentProgress(progress: any, action: string, value: number) {
    switch (action) {
      case 'WIN_MATCH':
        progress.wins = (progress.wins || 0) + value;
        progress.currentRound = (progress.currentRound || 0) + 1;
        break;
      case 'LOSE_MATCH':
        progress.losses = (progress.losses || 0) + value;
        break;
      case 'BYE':
        progress.byes = (progress.byes || 0) + value;
        progress.currentRound = (progress.currentRound || 0) + 1;
        break;
    }
    return progress;
  }

  // ============================================
  // VÉRIFIER SI LES OBJECTIFS SONT ATTEINTS
  // ============================================
  private checkObjectivesCompleted(progress: any, objectives: any[]): boolean {
    if (!objectives || objectives.length === 0) {
      // Pas d'objectifs = toujours terminé
      return true;
    }

    // Ici, vous pouvez définir une logique plus complexe
    // Par exemple, vérifier que chaque objectif a été atteint
    // ou qu'un certain seuil est franchi

    // Version simple : au moins un objectif terminé
    // return objectives.some(obj => progress[obj.key] >= obj.target);

    // Version plus stricte : tous les objectifs terminés
    return objectives.every(obj => {
      const currentValue = progress[obj.key] || 0;
      return currentValue >= obj.target;
    });
  }

  // ============================================
  // CALCULER LE SCORE D'UN PARTICIPANT
  // ============================================
  async calculateScore(eventId: string, userId: string): Promise<number> {
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

    if (!participation) return 0;

    const event = participation.event;
    const progress = participation.progress as any || {};

    switch (event.type) {
      case 'BATTLE':
        return progress.votesReceived || 0;
      
      case 'DESSIN':
        return Math.round(progress.averageRating || 0);
      
      case 'TICKETS':
        return progress.tickets || 0;
      
      case 'RISING_CREATOR':
        return progress.score || 0;
      
      case 'AWARDS':
        return progress.votesReceived || 0;
      
      case 'TOURNAMENT':
        return (progress.wins || 0) * 10;
      
      default:
        return 0;
    }
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
      include: {
        event: true,
      },
    });

    if (!participation) return null;

    const progress = participation.progress as any || {};
    const event = participation.event;
    const objectives = event.objectives as any[] || [];
    const now = new Date();

    // Calculer la progression pour chaque objectif
    const objectivesProgress = objectives.map(obj => ({
      ...obj,
      current: progress[obj.key] || 0,
      isCompleted: (progress[obj.key] || 0) >= obj.target,
      percentage: Math.min(100, ((progress[obj.key] || 0) / obj.target) * 100),
    }));

    // Calculer le score
    const score = await this.calculateScore(eventId, userId);

    return {
      ...participation,
      progress: {
        ...progress,
        score,
        objectives: objectivesProgress,
        totalProgress: objectives.length > 0
          ? objectivesProgress.reduce((acc, obj) => acc + obj.percentage, 0) / objectives.length
          : 100,
      },
    };
  }
}
