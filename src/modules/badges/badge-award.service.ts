import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadgeRarity, BadgeCategory } from '@prisma/client';

@Injectable()
export class BadgeAwardService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // ATTRIBUER UN BADGE À UN UTILISATEUR
  // ============================================
  async awardBadge(userId: string, badgeSlug: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { slug: badgeSlug },
    });

    if (!badge) {
      throw new Error('Badge non trouvé');
    }

    // Vérifier si l'utilisateur a déjà ce badge
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existing) {
      return { success: false, message: 'Badge déjà possédé' };
    }

    const userBadge = await this.prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        isDisplayed: badge.rarity === 'LEGENDARY' || badge.rarity === 'ULTIMATE',
      },
      include: {
        badge: true,
      },
    });

    // Notification
    await this.notificationsService.create({
      userId,
      type: 'SYSTEM',
      title: `🏅 Nouveau badge débloqué !`,
      body: `Vous avez obtenu le badge "${badge.name}" !`,
      link: `/profile/badges`,
      metadata: { badgeId: badge.id },
    });

    return { success: true, data: userBadge };
  }

  // ============================================
  // ATTRIBUER DES BADGES AUX GAGNANTS D'UN ÉVÉNEMENT
  // ============================================
  async awardEventBadges(eventId: string) {
    // Récupérer les classements
    const rankings = await this.prisma.eventRanking.findMany({
      where: { eventId },
      orderBy: { rank: 'asc' },
      take: 10,
      include: {
        user: true,
        event: true,
      },
    });

    const results = [];

    // Badges selon le type d'événement
    for (const ranking of rankings) {
      let badgeSlug: string | null = null;

      if (ranking.rank === 1) {
        badgeSlug = this.getFirstPlaceBadge(ranking.event.type);
      } else if (ranking.rank === 2) {
        badgeSlug = this.getSecondPlaceBadge(ranking.event.type);
      } else if (ranking.rank === 3) {
        badgeSlug = this.getThirdPlaceBadge(ranking.event.type);
      } else if (ranking.rank <= 10) {
        badgeSlug = this.getParticipationBadge(ranking.event.type);
      }

      if (badgeSlug) {
        try {
          const result = await this.awardBadge(ranking.userId, badgeSlug);
          results.push({ userId: ranking.userId, rank: ranking.rank, result });
        } catch (error) {
          console.error(`Erreur attribution badge pour ${ranking.userId}:`, error);
        }
      }
    }

    return results;
  }

  // ============================================
  // BADGES PAR TYPE D'ÉVÉNEMENT
  // ============================================
  private getFirstPlaceBadge(eventType: string): string {
    const badges: Record<string, string> = {
      BATTLE: 'champion-battle',
      DESSIN: 'maitre-du-trait',
      TICKETS: 'chasseur-de-tickets',
      RISING_CREATOR: 'rising-star',
      AWARDS: 'meilleur-dessinateur-2026',
      TOURNAMENT: 'champion-inkdrop',
    };
    return badges[eventType] || 'champion';
  }

  private getSecondPlaceBadge(eventType: string): string {
    const badges: Record<string, string> = {
      BATTLE: 'guerrier-mangaka',
      DESSIN: 'plume-dor',
      TICKETS: 'collectionneur',
      RISING_CREATOR: 'pousse-prometteuse',
      AWARDS: 'platine',
      TOURNAMENT: 'guerrier-legendaire',
    };
    return badges[eventType] || 'finaliste';
  }

  private getThirdPlaceBadge(eventType: string): string {
    const badges: Record<string, string> = {
      BATTLE: 'defenseur',
      DESSIN: 'pinceau-dargent',
      TICKETS: 'chanceux',
      RISING_CREATOR: 'decollage',
      AWARDS: 'or',
      TOURNAMENT: 'demi-finaliste',
    };
    return badges[eventType] || 'bronze';
  }

  private getParticipationBadge(eventType: string): string {
    const badges: Record<string, string> = {
      BATTLE: 'esprit-combattant',
      DESSIN: 'artiste-emergent',
      TICKETS: 'joueur-fidele',
      RISING_CREATOR: 'revele',
      AWARDS: 'participant-awards',
      TOURNAMENT: 'veteran',
    };
    return badges[eventType] || 'participant';
  }

  // ============================================
  // CRÉER LES BADGES PAR DÉFAUT
  // ============================================
  async seedDefaultBadges() {
    const badges = [
      // === BADGES ULTIMES ===
      {
        name: 'Meilleur Dessinateur 2026',
        slug: 'meilleur-dessinateur-2026',
        description: 'Le meilleur dessinateur de l\'année 2026',
        icon: 'crown',
        color: '#FBBF24',
        gradient: 'from-amber-400 to-amber-600',
        glowColor: '#FBBF24',
        rarity: 'ULTIMATE',
        category: 'COMPETITION',
        eventType: 'AWARDS',
      },
      {
        name: 'Champion INKDROP',
        slug: 'champion-inkdrop',
        description: 'Vainqueur du Tournoi INKDROP',
        icon: 'trophy',
        color: '#FBBF24',
        gradient: 'from-amber-400 to-amber-600',
        glowColor: '#FBBF24',
        rarity: 'ULTIMATE',
        category: 'COMPETITION',
        eventType: 'TOURNAMENT',
      },
      {
        name: 'Légende INKDROP',
        slug: 'legende-inkdrop',
        description: 'A remporté les INKDROP Awards 3 fois',
        icon: 'crown',
        color: '#EF4444',
        gradient: 'from-red-400 to-amber-500',
        glowColor: '#EF4444',
        rarity: 'ULTIMATE',
        category: 'COMPETITION',
        eventType: 'AWARDS',
      },

      // === BADGES LÉGENDAIRES ===
      {
        name: 'Champion Battle',
        slug: 'champion-battle',
        description: 'Vainqueur de la Battle de mangas',
        icon: 'trophy',
        color: '#FBBF24',
        gradient: 'from-amber-400 to-amber-600',
        glowColor: '#FBBF24',
        rarity: 'LEGENDARY',
        category: 'EVENT',
        eventType: 'BATTLE',
      },
      {
        name: 'Maître du Trait',
        slug: 'maitre-du-trait',
        description: 'Vainqueur du Défi Dessin',
        icon: 'sparkles',
        color: '#A78BFA',
        gradient: 'from-purple-400 to-violet-500',
        glowColor: '#A78BFA',
        rarity: 'LEGENDARY',
        category: 'EVENT',
        eventType: 'DESSIN',
      },
      {
        name: 'Chasseur de Tickets',
        slug: 'chasseur-de-tickets',
        description: 'Plus de tickets gagnés',
        icon: 'ticket',
        color: '#60A5FA',
        gradient: 'from-blue-400 to-blue-500',
        glowColor: '#60A5FA',
        rarity: 'LEGENDARY',
        category: 'EVENT',
        eventType: 'TICKETS',
      },
      {
        name: 'Rising Star',
        slug: 'rising-star',
        description: 'Meilleur créateur émergent',
        icon: 'star',
        color: '#34D399',
        gradient: 'from-emerald-400 to-emerald-500',
        glowColor: '#34D399',
        rarity: 'LEGENDARY',
        category: 'EVENT',
        eventType: 'RISING_CREATOR',
      },

      // === BADGES ÉPIQUES ===
      {
        name: 'Guerrier Mangaka',
        slug: 'guerrier-mangaka',
        description: 'Finaliste de la Battle',
        icon: 'sword',
        color: '#94A3B8',
        gradient: 'from-gray-300 to-gray-400',
        glowColor: '#94A3B8',
        rarity: 'EPIC',
        category: 'EVENT',
        eventType: 'BATTLE',
      },
      {
        name: 'Plume d\'Or',
        slug: 'plume-dor',
        description: 'Finaliste du Défi Dessin',
        icon: 'pen',
        color: '#FCD34D',
        gradient: 'from-amber-300 to-amber-400',
        glowColor: '#FCD34D',
        rarity: 'EPIC',
        category: 'EVENT',
        eventType: 'DESSIN',
      },
      {
        name: 'Platine',
        slug: 'platine',
        description: '2ème place des INKDROP Awards',
        icon: 'medal',
        color: '#94A3B8',
        gradient: 'from-gray-300 to-gray-400',
        glowColor: '#94A3B8',
        rarity: 'EPIC',
        category: 'COMPETITION',
        eventType: 'AWARDS',
      },
      {
        name: 'Guerrier Légendaire',
        slug: 'guerrier-legendaire',
        description: 'Finaliste du Tournament',
        icon: 'shield',
        color: '#FBBF24',
        gradient: 'from-amber-400 to-amber-500',
        glowColor: '#FBBF24',
        rarity: 'EPIC',
        category: 'COMPETITION',
        eventType: 'TOURNAMENT',
      },

      // === BADGES RARES ===
      {
        name: 'Défenseur',
        slug: 'defenseur',
        description: '3ème place de la Battle',
        icon: 'shield',
        color: '#F59E0B',
        gradient: 'from-amber-500 to-amber-600',
        glowColor: '#F59E0B',
        rarity: 'RARE',
        category: 'EVENT',
        eventType: 'BATTLE',
      },
      {
        name: 'Pinceau d\'Argent',
        slug: 'pinceau-dargent',
        description: '3ème place du Défi Dessin',
        icon: 'brush',
        color: '#94A3B8',
        gradient: 'from-gray-300 to-gray-400',
        glowColor: '#94A3B8',
        rarity: 'RARE',
        category: 'EVENT',
        eventType: 'DESSIN',
      },
      {
        name: 'Or',
        slug: 'or',
        description: '3ème place des INKDROP Awards',
        icon: 'medal',
        color: '#FBBF24',
        gradient: 'from-amber-400 to-amber-500',
        glowColor: '#FBBF24',
        rarity: 'RARE',
        category: 'COMPETITION',
        eventType: 'AWARDS',
      },

      // === BADGES COMMUNS ===
      {
        name: 'Esprit Combattant',
        slug: 'esprit-combattant',
        description: 'Participation à 5 Battles',
        icon: 'flame',
        color: '#F97316',
        gradient: 'from-orange-400 to-orange-500',
        glowColor: '#F97316',
        rarity: 'UNCOMMON',
        category: 'EVENT',
        eventType: 'BATTLE',
      },
      {
        name: 'Artiste Émergent',
        slug: 'artiste-emergent',
        description: 'Participation à 5 Défis',
        icon: 'sparkles',
        color: '#A78BFA',
        gradient: 'from-purple-400 to-purple-500',
        glowColor: '#A78BFA',
        rarity: 'UNCOMMON',
        category: 'EVENT',
        eventType: 'DESSIN',
      },
      {
        name: 'Joueur Fidèle',
        slug: 'joueur-fidele',
        description: 'Participation à 3 Semaines des Tickets',
        icon: 'ticket',
        color: '#60A5FA',
        gradient: 'from-blue-400 to-blue-500',
        glowColor: '#60A5FA',
        rarity: 'UNCOMMON',
        category: 'EVENT',
        eventType: 'TICKETS',
      },
      {
        name: 'Participant',
        slug: 'participant',
        description: 'Participation à un événement INKDROP',
        icon: 'star',
        color: '#6B7280',
        gradient: 'from-gray-400 to-gray-500',
        glowColor: '#6B7280',
        rarity: 'COMMON',
        category: 'EVENT',
        eventType: null,
      },
    ];

    for (const badge of badges) {
      try {
        await this.prisma.badge.create({
          data: badge,
        });
        console.log(`✅ Badge "${badge.name}" créé`);
      } catch (error) {
        console.log(`⚠️ Badge "${badge.name}" existe déjà`);
      }
    }

    return { success: true, message: 'Badges seedés avec succès' };
  }
}
