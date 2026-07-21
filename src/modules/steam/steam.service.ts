import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const STEAM_LEVELS = [
  { level: 1, label: '🥉 Bronze', minPoints: 0, reward: 50 },
  { level: 2, label: '🥈 Argent', minPoints: 1000, reward: 150 },
  { level: 3, label: '🥇 Or', minPoints: 5000, reward: 500 },
  { level: 4, label: '💎 Platine', minPoints: 20000, reward: 1500 },
  { level: 5, label: '👑 Diamant', minPoints: 100000, reward: 5000 },
];

export const ACTION_POINTS = {
  read_chapter: 10,
  comment: 5,
  like: 2,
  publish_chapter: 50,
  share: 5,
  follow: 10,
};

@Injectable()
export class SteamService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // AJOUTER DES POINTS STEAM
  // ============================================
  async addPoints(userId: string, action: string, value: number = 1) {
    const points = (ACTION_POINTS[action] || 0) * value;

    if (points === 0) return;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        steamPoints: { increment: points },
      },
    });

    const newLevel = this.getLevel(user.steamPoints);
    if (user.steamLevel !== newLevel) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { steamLevel: newLevel },
      });

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: '🏆 Nouveau niveau Steam !',
          body: `Vous avez atteint le niveau ${this.getLevelLabel(newLevel)}`,
        },
      });
    }

    return { points, total: user.steamPoints, level: newLevel, label: this.getLevelLabel(newLevel) };
  }

  // ============================================
  // OBTENIR LE NIVEAU (numéro)
  // ============================================
  getLevel(points: number): number {
    for (const level of STEAM_LEVELS.slice().reverse()) {
      if (points >= level.minPoints) {
        return level.level;
      }
    }
    return STEAM_LEVELS[0].level;
  }

  // ============================================
  // OBTENIR LE LIBELLÉ DU NIVEAU
  // ============================================
  getLevelLabel(level: number): string {
    return STEAM_LEVELS.find((l) => l.level === level)?.label || STEAM_LEVELS[0].label;
  }

  // ============================================
  // STATISTIQUES STEAM D'UN UTILISATEUR
  // ============================================
  async getUserSteam(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        steamPoints: true,
        steamLevel: true,
      },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const currentLevel = this.getLevel(user.steamPoints);
    const nextLevel = STEAM_LEVELS.find((l) => l.minPoints > user.steamPoints);

    return {
      points: user.steamPoints,
      level: currentLevel,
      label: this.getLevelLabel(currentLevel),
      nextLevel: nextLevel ? {
        level: nextLevel.level,
        name: nextLevel.label,
        pointsNeeded: nextLevel.minPoints - user.steamPoints,
        totalNeeded: nextLevel.minPoints,
      } : null,
      progress: nextLevel
        ? Math.round((user.steamPoints / nextLevel.minPoints) * 100)
        : 100,
    };
  }
}