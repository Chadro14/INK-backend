import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BadgeRarity, BadgeCategory, EventType } from '@prisma/client';

@Injectable()
export class BadgesService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRÉER UN BADGE
  // ============================================
  async createBadge(data: {
    name: string;
    slug: string;
    description?: string;
    icon: string;
    color?: string;
    gradient?: string;
    glowColor?: string;
    rarity: BadgeRarity;
    category: BadgeCategory;
    eventType?: EventType;
  }) {
    return this.prisma.badge.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        icon: data.icon,
        color: data.color || '#FBBF24',
        gradient: data.gradient || null,
        glowColor: data.glowColor || null,
        rarity: data.rarity,
        category: data.category,
        eventType: data.eventType || null,
        isActive: true,
      },
    });
  }

  // ============================================
  // RÉCUPÉRER TOUS LES BADGES
  // ============================================
  async getAllBadges() {
    return this.prisma.badge.findMany({
      orderBy: [
        { rarity: 'desc' },
        { category: 'asc' },
      ],
    });
  }

  // ============================================
  // RÉCUPÉRER UN BADGE PAR SLUG
  // ============================================
  async getBadgeBySlug(slug: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { slug },
    });

    if (!badge) {
      throw new NotFoundException('Badge non trouvé');
    }

    return badge;
  }

  // ============================================
  // RÉCUPÉRER LES BADGES D'UN UTILISATEUR
  // ============================================
  async getUserBadges(userId: string) {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });

    return userBadges;
  }

  // ============================================
  // RÉCUPÉRER LES BADGES D'UN UTILISATEUR PAR RARETÉ
  // ============================================
  async getUserBadgesByRarity(userId: string, rarity: BadgeRarity) {
    return this.prisma.userBadge.findMany({
      where: {
        userId,
        badge: { rarity },
      },
      include: {
        badge: true,
      },
    });
  }

  // ============================================
  // VÉRIFIER SI UN UTILISATEUR A UN BADGE
  // ============================================
  async hasBadge(userId: string, badgeSlug: string): Promise<boolean> {
    const badge = await this.prisma.badge.findUnique({
      where: { slug: badgeSlug },
    });

    if (!badge) return false;

    const userBadge = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    return !!userBadge;
  }

  // ============================================
  // AFFICHER/CACHER UN BADGE SUR LE PROFIL
  // ============================================
  async toggleBadgeDisplay(userId: string, userBadgeId: string) {
    const userBadge = await this.prisma.userBadge.findFirst({
      where: {
        id: userBadgeId,
        userId,
      },
    });

    if (!userBadge) {
      throw new NotFoundException('Badge non trouvé');
    }

    return this.prisma.userBadge.update({
      where: { id: userBadgeId },
      data: { isDisplayed: !userBadge.isDisplayed },
    });
  }

  // ============================================
  // RÉCUPÉRER LES BADGES AFFICHÉS D'UN UTILISATEUR
  // ============================================
  async getDisplayedBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: {
        userId,
        isDisplayed: true,
      },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });
  }

  // ============================================
  // SUPPRIMER UN BADGE (ADMIN)
  // ============================================
  async deleteBadge(badgeId: string) {
    await this.prisma.badge.delete({
      where: { id: badgeId },
    });
    return { success: true };
  }
}
