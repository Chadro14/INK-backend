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
        avatarColor: true,
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
        email: true,
        avatarUrl: true,
        avatarColor: true,
        bio: true,
        role: true,
        isCertified: true,
        badgeColor: true,
        premiumActive: true,
        premiumPlan: true,
        createdAt: true,
        manas: true,
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

  // ============================================
  // ✅ RÉCUPÉRER LES MANGAS D'UN CRÉATEUR
  // ============================================
  async getCreatorMangas(username: string) {
    const creator = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        mangas: {
          where: { status: 'ONGOING' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            coverUrl: true,
            description: true,
            status: true,
            viewsCount: true,
            likesCount: true,
            createdAt: true,
            _count: {
              select: {
                chapters: true,
                comments: true,
              },
            },
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException('Créateur non trouvé');
    }

    return creator.mangas;
  }

  // ============================================
  // ✅ RÉCUPÉRER LES STATISTIQUES D'UN CRÉATEUR
  // ============================================
  async getCreatorStats(username: string) {
    const creator = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
          },
        },
        mangas: {
          select: {
            viewsCount: true,
            likesCount: true,
            _count: {
              select: {
                chapters: true,
              },
            },
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException('Créateur non trouvé');
    }

    const totalViews = creator.mangas.reduce((acc, m) => acc + m.viewsCount, 0);
    const totalLikes = creator.mangas.reduce((acc, m) => acc + m.likesCount, 0);
    const totalChapters = creator.mangas.reduce((acc, m) => acc + m._count.chapters, 0);

    return {
      mangas: creator._count.mangas,
      followers: creator._count.followers,
      views: totalViews,
      likes: totalLikes,
      chapters: totalChapters,
    };
  }
}
