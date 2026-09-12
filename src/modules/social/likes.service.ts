import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async like(userId: string, mangaId: string, chapterId?: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { id: true, likesCount: true, authorId: true, title: true, slug: true },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        mangaId,
        ...(chapterId && { chapterId }),
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });

      const updated = await this.prisma.manga.update({
        where: { id: mangaId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return {
        liked: false,
        likesCount: updated.likesCount,
      };
    }

    await this.prisma.like.create({
      data: {
        userId,
        mangaId,
        chapterId: chapterId || null,
      },
    });

    const updated = await this.prisma.manga.update({
      where: { id: mangaId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    await this.notifyAuthorOnLike(userId, manga);

    return {
      liked: true,
      likesCount: updated.likesCount,
    };
  }

  private async notifyAuthorOnLike(
    likerId: string,
    manga: { id: string; authorId: string; title: string; slug: string | null },
  ) {
    if (likerId === manga.authorId) return;

    const existingUnread = await this.prisma.notification.findFirst({
      where: {
        userId: manga.authorId,
        fromUserId: likerId,
        type: NotificationType.NEW_LIKE,
        isRead: false,
        metadata: {
          path: ['mangaId'],
          equals: manga.id,
        },
      },
    });

    if (existingUnread) return;

    const liker = await this.prisma.user.findUnique({
      where: { id: likerId },
      select: { username: true },
    });

    if (!liker) return;

    const link = `/manga/${manga.slug || manga.id}`;

    await this.notificationsService.create({
      userId: manga.authorId,
      fromUserId: likerId,
      type: NotificationType.NEW_LIKE,
      title: 'Nouveau like',
      body: `@${liker.username} a aimé "${manga.title}"`,
      link,
      metadata: { mangaId: manga.id, likerId },
    });
  }

  async hasLiked(userId: string, mangaId: string, chapterId?: string) {
    const like = await this.prisma.like.findFirst({
      where: {
        userId,
        mangaId,
        ...(chapterId && { chapterId }),
      },
    });

    return { liked: !!like };
  }

  async countLikes(mangaId: string) {
    return this.prisma.like.count({
      where: { mangaId },
    });
  }
}
