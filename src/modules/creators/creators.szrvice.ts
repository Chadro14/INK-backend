import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CreatorsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RÉCUPÉRER LES CRÉATEURS CERTIFIÉS (TOP)
  // ============================================
  async getTopCreators(limit: number = 6) {
    return this.prisma.user.findMany({
      where: {
        isCertified: true,
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        isCertified: true,
        badgeColor: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
          },
        },
      },
      orderBy: {
        followers: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  // ============================================
  // RÉCUPÉRER UN CRÉATEUR PAR USERNAME
  // ============================================
  async getCreatorByUsername(username: string) {
    const creator = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        isCertified: true,
        badgeColor: true,
        createdAt: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException('Créateur non trouvé');
    }

    return creator;
  }
}