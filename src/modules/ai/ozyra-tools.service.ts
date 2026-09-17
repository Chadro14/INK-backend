// src/modules/ai/ozyra-tools.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OzyraToolName,
  OzyraContext,
  OzyraToolResult,
  OzyraPeriod,
} from './interfaces/ai-tools.interface';

@Injectable()
export class OzyraToolsService {
  private readonly logger = new Logger(OzyraToolsService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // DISPATCHER : exécute la bonne fonction selon le nom
  // ============================================
  async execute(
    toolName: string,
    args: any,
    context: OzyraContext,
  ): Promise<OzyraToolResult> {
    try {
      switch (toolName) {
        case OzyraToolName.SEARCH_MANGA:
          return await this.searchManga(args);

        case OzyraToolName.GET_TOP_MANGAS:
          return await this.getTopMangas(args);

        case OzyraToolName.GET_TOP_CREATORS:
          return await this.getTopCreators(args);

        case OzyraToolName.GET_MANGA_DETAILS:
          return await this.getMangaDetails(args);

        case OzyraToolName.GET_USER_BALANCE:
          return await this.getUserBalance(context);

        case OzyraToolName.GET_USER_TICKETS:
          return await this.getUserTickets(context);

        case OzyraToolName.GET_USER_MANGAS:
          return await this.getUserMangas(context);

        case OzyraToolName.GET_PREMIUM_INFO:
          return await this.getPremiumInfo(context);

        default:
          return {
            toolCallId: '',
            toolName,
            success: false,
            error: `Fonction inconnue : ${toolName}`,
          };
      }
    } catch (error) {
      this.logger.error(
        `Erreur dans tool "${toolName}" : ${error.message}`,
      );
      return {
        toolCallId: '',
        toolName,
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================
  // 1. SEARCH_MANGA — cherche un manga par titre/auteur/genre
  // ============================================
  private async searchManga(args: {
    query: string;
    limit?: number;
  }): Promise<OzyraToolResult> {
    const query = (args.query || '').trim();
    const limit = Math.min(args.limit || 5, 10);

    if (!query) {
      return {
        toolCallId: '',
        toolName: OzyraToolName.SEARCH_MANGA,
        success: false,
        error: 'Le paramètre "query" est obligatoire.',
      };
    }

    const words = query.split(' ').filter((w) => w.length > 2);
    const searchTerms = words.length > 0 ? words : [query];

    const mangas = await this.prisma.manga.findMany({
      where: {
        OR: searchTerms.flatMap((word) => [
          { title: { contains: word, mode: 'insensitive' as const } },
          { description: { contains: word, mode: 'insensitive' as const } },
          { genre: { has: word } },
          { tags: { has: word } },
        ]),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverUrl: true,
        status: true,
        genre: true,
        viewsCount: true,
        likesCount: true,
        subscribersCount: true,
        author: {
          select: {
            id: true,
            username: true,
            isCertified: true,
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
      orderBy: [{ viewsCount: 'desc' }, { likesCount: 'desc' }],
      take: limit,
    });

    return {
      toolCallId: '',
      toolName: OzyraToolName.SEARCH_MANGA,
      success: true,
      data: {
        query,
        count: mangas.length,
        mangas: mangas.map((m) => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          description: m.description?.slice(0, 200) || null,
          coverUrl: m.coverUrl,
          status: m.status,
          genre: m.genre,
          views: m.viewsCount,
          likes: m.likesCount,
          subscribers: m.subscribersCount,
          chaptersCount: m._count.chapters,
          author: {
            id: m.author.id,
            username: m.author.username,
            isCertified: m.author.isCertified,
          },
          url: `/manga/${m.id}`,
        })),
      },
    };
  }

  // ============================================
  // 2. GET_TOP_MANGAS — top mangas par vues/likes/abonnés
  // ============================================
  private async getTopMangas(args: {
    period?: OzyraPeriod;
    limit?: number;
  }): Promise<OzyraToolResult> {
    const period = args.period || 'week';
    const limit = Math.min(args.limit || 5, 10);

    const dateFilter = this.getDateFilter(period);

    const mangas = await this.prisma.manga.findMany({
      where:
        period === 'all'
          ? {}
          : {
              createdAt: { gte: dateFilter },
            },
      select: {
        id: true,
        slug: true,
        title: true,
        coverUrl: true,
        genre: true,
        viewsCount: true,
        likesCount: true,
        subscribersCount: true,
        author: {
          select: {
            id: true,
            username: true,
            isCertified: true,
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
      orderBy: [
        { viewsCount: 'desc' },
        { likesCount: 'desc' },
        { subscribersCount: 'desc' },
      ],
      take: limit,
    });

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_TOP_MANGAS,
      success: true,
      data: {
        period,
        count: mangas.length,
        mangas: mangas.map((m, index) => ({
          rank: index + 1,
          id: m.id,
          title: m.title,
          coverUrl: m.coverUrl,
          genre: m.genre,
          views: m.viewsCount,
          likes: m.likesCount,
          subscribers: m.subscribersCount,
          chaptersCount: m._count.chapters,
          author: {
            username: m.author.username,
            isCertified: m.author.isCertified,
          },
          url: `/manga/${m.id}`,
        })),
      },
    };
  }

  // ============================================
  // 3. GET_TOP_CREATORS — top créateurs par abonnés/vues
  // ============================================
  private async getTopCreators(args: {
    period?: OzyraPeriod;
    limit?: number;
  }): Promise<OzyraToolResult> {
    const period = args.period || 'week';
    const limit = Math.min(args.limit || 5, 10);

    const dateFilter = this.getDateFilter(period);

    const creators = await this.prisma.user.findMany({
      where: {
        role: 'CREATOR',
        mangas: {
          some: {},
        },
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        isCertified: true,
        badgeColor: true,
        createdAt: true,
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
            subscribersCount: true,
          },
        },
      },
      take: 50, // on prend un pool large puis on trie en mémoire
    });

    // Calcul des totaux par créateur
    const enriched = creators.map((c) => {
      const totalViews = c.mangas.reduce((sum, m) => sum + m.viewsCount, 0);
      const totalLikes = c.mangas.reduce((sum, m) => sum + m.likesCount, 0);
      const totalSubs = c.mangas.reduce(
        (sum, m) => sum + m.subscribersCount,
        0,
      );

      return {
        id: c.id,
        username: c.username,
        avatarUrl: c.avatarUrl,
        isCertified: c.isCertified,
        badgeColor: c.badgeColor,
        mangasCount: c._count.mangas,
        followers: c._count.followers,
        totalViews,
        totalLikes,
        totalSubs,
        url: `/creator/${c.username}`,
      };
    });

    // Tri par abonnés totaux, puis vues
    enriched.sort((a, b) => {
      if (b.totalSubs !== a.totalSubs) return b.totalSubs - a.totalSubs;
      return b.totalViews - a.totalViews;
    });

    const top = enriched.slice(0, limit);

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_TOP_CREATORS,
      success: true,
      data: {
        period,
        count: top.length,
        creators: top.map((c, index) => ({
          rank: index + 1,
          ...c,
        })),
      },
    };
  }

  // ============================================
  // 4. GET_MANGA_DETAILS — détails d'un manga précis
  // ============================================
  private async getMangaDetails(args: {
    mangaId?: string;
    title?: string;
  }): Promise<OzyraToolResult> {
    if (!args.mangaId && !args.title) {
      return {
        toolCallId: '',
        toolName: OzyraToolName.GET_MANGA_DETAILS,
        success: false,
        error: 'Il faut fournir "mangaId" ou "title".',
      };
    }

    const manga = await this.prisma.manga.findFirst({
      where: args.mangaId
        ? { id: args.mangaId }
        : { title: { contains: args.title, mode: 'insensitive' as const } },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverUrl: true,
        status: true,
        genre: true,
        tags: true,
        viewsCount: true,
        likesCount: true,
        subscribersCount: true,
        commentsCount: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
          },
        },
        _count: {
          select: { chapters: true, comments: true },
        },
      },
    });

    if (!manga) {
      return {
        toolCallId: '',
        toolName: OzyraToolName.GET_MANGA_DETAILS,
        success: false,
        error: 'Manga non trouvé.',
      };
    }

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_MANGA_DETAILS,
      success: true,
      data: {
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        description: manga.description,
        coverUrl: manga.coverUrl,
        status: manga.status,
        genre: manga.genre,
        tags: manga.tags,
        views: manga.viewsCount,
        likes: manga.likesCount,
        subscribers: manga.subscribersCount,
        commentsCount: manga.commentsCount,
        chaptersCount: manga._count.chapters,
        createdAt: manga.createdAt,
        author: manga.author,
        url: `/manga/${manga.id}`,
      },
    };
  }

  // ============================================
  // 5. GET_USER_BALANCE — solde MANAS du user
  // ============================================
  private async getUserBalance(
    context: OzyraContext,
  ): Promise<OzyraToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { manas: true },
    });

    if (!user) {
      return {
        toolCallId: '',
        toolName: OzyraToolName.GET_USER_BALANCE,
        success: false,
        error: 'Utilisateur non trouvé.',
      };
    }

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_USER_BALANCE,
      success: true,
      data: {
        manas: user.manas,
        userId: context.userId,
      },
    };
  }

  // ============================================
  // 6. GET_USER_TICKETS — solde de tickets
  // ============================================
  private async getUserTickets(
    context: OzyraContext,
  ): Promise<OzyraToolResult> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { userId: context.userId },
      select: { amount: true },
    });

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_USER_TICKETS,
      success: true,
      data: {
        tickets: ticket?.amount || 0,
        unlimited: context.premiumActive,
        userId: context.userId,
      },
    };
  }

  // ============================================
  // 7. GET_USER_MANGAS — mangas du user connecté
  // ============================================
  private async getUserMangas(
    context: OzyraContext,
  ): Promise<OzyraToolResult> {
    const mangas = await this.prisma.manga.findMany({
      where: { authorId: context.userId },
      select: {
        id: true,
        slug: true,
        title: true,
        coverUrl: true,
        status: true,
        genre: true,
        viewsCount: true,
        likesCount: true,
        subscribersCount: true,
        createdAt: true,
        _count: {
          select: { chapters: true, comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_USER_MANGAS,
      success: true,
      data: {
        userId: context.userId,
        count: mangas.length,
        mangas: mangas.map((m) => ({
          id: m.id,
          title: m.title,
          coverUrl: m.coverUrl,
          status: m.status,
          genre: m.genre,
          views: m.viewsCount,
          likes: m.likesCount,
          subscribers: m.subscribersCount,
          chaptersCount: m._count.chapters,
          commentsCount: m._count.comments,
          createdAt: m.createdAt,
          url: `/manga/${m.id}`,
        })),
      },
    };
  }

  // ============================================
  // 8. GET_PREMIUM_INFO — statut Premium du user
  // ============================================
  private async getPremiumInfo(
    context: OzyraContext,
  ): Promise<OzyraToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: {
        premiumActive: true,
        premiumPlan: true,
        premiumExpires: true,
        role: true,
      },
    });

    if (!user) {
      return {
        toolCallId: '',
        toolName: OzyraToolName.GET_PREMIUM_INFO,
        success: false,
        error: 'Utilisateur non trouvé.',
      };
    }

    // Vérifie si expiré
    const isExpired =
      user.premiumExpires !== null &&
      new Date(user.premiumExpires) < new Date();

    const isActive = user.premiumActive && !isExpired;

    return {
      toolCallId: '',
      toolName: OzyraToolName.GET_PREMIUM_INFO,
      success: true,
      data: {
        userId: context.userId,
        role: user.role,
        premiumActive: isActive,
        premiumPlan: user.premiumPlan,
        premiumExpires: user.premiumExpires,
        isAdmin: user.role === 'ADMIN',
        isCreator: user.role === 'CREATOR',
      },
    };
  }

  // ============================================
  // HELPER : calcule la date de début selon la période
  // ============================================
  private getDateFilter(period: OzyraPeriod): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return new Date(0); // 1970
    }
  }
}
