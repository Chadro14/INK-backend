import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const STEAM_LEVELS = [
  { level: 1, name: 'Bronze', minPoints: 0, reward: 50 },
  { level: 2, name: 'Argent', minPoints: 1000, reward: 150 },
  { level: 3, name: 'Or', minPoints: 5000, reward: 500 },
  { level: 4, name: 'Platine', minPoints: 20000, reward: 1500 },
  { level: 5, name: 'Diamant', minPoints: 100000, reward: 5000 },
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
          title: 'Nouveau niveau Steam',
          body: `Vous avez atteint le niveau ${this.getLevelName(newLevel)}`,
        },
      });
    }

    return { points, total: user.steamPoints, level: newLevel };
  }

  getLevel(points: number): number {
    let level = 1;
    for (const lvl of STEAM_LEVELS) {
      if (points >= lvl.minPoints) {
        level = lvl.level;
      }
    }
    return level;
  }

  getLevelName(level: number): string {
    const found = STEAM_LEVELS.find((l) => l.level === level);
    return found ? found.name : 'Bronze';
  }

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

    const currentLevel = user.steamLevel || 1;
    const nextLevel = STEAM_LEVELS.find((l) => l.level > currentLevel);

    return {
      points: user.steamPoints || 0,
      level: currentLevel,
      levelName: this.getLevelName(currentLevel),
      nextLevel: nextLevel ? {
        level: nextLevel.level,
        name: nextLevel.name,
        pointsNeeded: nextLevel.minPoints - (user.steamPoints || 0),
        totalNeeded: nextLevel.minPoints,
      } : null,
      progress: nextLevel
        ? Math.round(((user.steamPoints || 0) / nextLevel.minPoints) * 100)
        : 100,
    };
  }
}