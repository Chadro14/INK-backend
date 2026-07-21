import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowService } from '../follow/follow.service';
import { StatsQueryDto, StatsPeriod } from './dto/stats-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private followService: FollowService,
  ) {}

  // ============================================
  // VUE D'ENSEMBLE (OVERVIEW)
  // ============================================
  async getOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        mangas: {
          include: {
            chapters: true,
            likes: true,
            comments: true,
            subscriptions: true,
          },
        },
        earnings: true,
        payouts: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const { followersCount, followingCount } = await this.followService.getFollowCounts(userId);

    const totalChapters = user.mangas.reduce((sum, m) => sum + m.chapters.length, 0);
    const totalViews = user.mangas.reduce((sum, m) => sum + m.viewsCount, 0);
    const totalLikes = user.mangas.reduce((sum, m) => sum + m.likesCount, 0);
    const totalComments = user.mangas.reduce((sum, m) => sum + m.commentsCount, 0);
    const totalSubscriptions = user.mangas.reduce((sum, m) => sum + m.subscribersCount, 0);

    const totalEarnings = user.earnings
      .filter((e) => e.status === 'PAID')
      .reduce((sum, e) => sum + e.amount, 0);

    const pendingEarnings = user.earnings
      .filter((e) => e.status === 'PENDING')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      user: {
        username: user.username,
        avatarUrl: user.avatarUrl,
        isCertified: user.isCertified,
        premiumActive: user.premiumActive,
      },
      mangas: {
        total: user.mangas.length,
        totalChapters,
        totalViews,
        totalLikes,
        totalComments,
        totalSubscriptions,
      },
      social: {
        followers: followersCount,
        following: followingCount,
      },
      earnings: {
        total: totalEarnings,
        pending: pendingEarnings,
      },
      topManga: user.mangas.length > 0
        ? user.mangas.reduce((a, b) => (a.viewsCount > b.viewsCount ? a : b))
        : null,
    };
  }

  // ============================================
  // STATISTIQUES AVANCÉES
  // ============================================
  async getStats(userId: string, query: StatsQueryDto) {
    const { period, startDate, endDate } = query;

    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.gte = new Date(startDate);
      dateFilter.lte = new Date(endDate);
    } else if (period) {
      const now = new Date();
      const start = new Date();
      switch (period) {
        case StatsPeriod.DAY:
          start.setDate(now.getDate() - 1);
          break;
        case StatsPeriod.WEEK:
          start.setDate(now.getDate() - 7);
          break;
        case StatsPeriod.MONTH:
          start.setMonth(now.getMonth() - 1);
          break;
        case StatsPeriod.YEAR:
          start.setFullYear(now.getFullYear() - 1);
          break;
      }
      dateFilter.gte = start;
      dateFilter.lte = now;
    }

    const mangas = await this.prisma.manga.findMany({
      where: {
        authorId: userId,
        createdAt: dateFilter,
      },
    });

    const viewsHistory = mangas.map((m) => ({
      date: m.createdAt,
      views: m.viewsCount,
    }));

    const likesHistory = mangas.map((m) => ({
      date: m.createdAt,
      likes: m.likesCount,
    }));

    const totalViews = mangas.reduce((sum, m) => sum + m.viewsCount, 0);
    const totalLikes = mangas.reduce((sum, m) => sum + m.likesCount, 0);
    const totalComments = mangas.reduce((sum, m) => sum + m.commentsCount, 0);
    const totalSubscriptions = mangas.reduce((sum, m) => sum + m.subscribersCount, 0);

    return {
      period,
      totalViews,
      totalLikes,
      totalComments,
      totalSubscriptions,
      viewsHistory,
      likesHistory,
      topMangas: mangas.sort((a, b) => b.viewsCount - a.viewsCount).slice(0, 5),
    };
  }

  // ============================================
  // REVENUS DÉTAILLÉS
  // ============================================
  async getEarnings(userId: string) {
    const earnings = await this.prisma.creatorEarning.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaid = earnings
      .filter((e) => e.status === 'PAID')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalPending = earnings
      .filter((e) => e.status === 'PENDING')
      .reduce((sum, e) => sum + e.amount, 0);

    const bySource = earnings.reduce((acc, e) => {
      if (!acc[e.source]) acc[e.source] = 0;
      acc[e.source] += e.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: totalPaid + totalPending,
      paid: totalPaid,
      pending: totalPending,
      bySource,
      history: earnings,
    };
  }
}