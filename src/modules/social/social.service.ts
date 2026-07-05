import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private commentsService: CommentsService,
    private likesService: LikesService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  // ============================================
  // STATISTIQUES D'ENGAGEMENT POUR UN MANGA
  // ============================================
  async getMangaEngagement(mangaId: string) {
    const [likes, comments, subscriptions] = await Promise.all([
      this.prisma.like.count({ where: { mangaId } }),
      this.prisma.comment.count({ where: { mangaId, status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { mangaId } }),
    ]);

    return { likes, comments, subscriptions };
  }

  // ============================================
  // STATISTIQUES POUR UN CRÉATEUR
  // ============================================
  async getCreatorEngagement(creatorId: string) {
    const mangas = await this.prisma.manga.findMany({
      where: { authorId: creatorId },
      select: { id: true },
    });

    const mangaIds = mangas.map(m => m.id);

    const [totalLikes, totalComments, totalSubscriptions] = await Promise.all([
      this.prisma.like.count({ where: { mangaId: { in: mangaIds } } }),
      this.prisma.comment.count({ where: { mangaId: { in: mangaIds }, status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { mangaId: { in: mangaIds } } }),
    ]);

    return {
      totalLikes,
      totalComments,
      totalSubscriptions,
      mangaCount: mangaIds.length,
    };
  }
}