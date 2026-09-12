import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

const FROM_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  avatarColor: true,
  isCertified: true,
  badgeColor: true,
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    userId: string;
    fromUserId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    metadata?: any;
  }) {
    const cleanTitle = data.title
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .trim();
    const cleanBody = data.body
      ? data.body.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
      : null;

    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        fromUserId: data.fromUserId || null,
        type: data.type,
        title: cleanTitle || data.title,
        body: cleanBody || data.body || null,
        link: data.link || null,
        metadata: data.metadata || null,
      },
      include: {
        fromUser: { select: FROM_USER_SELECT },
      },
    });
  }

  async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 50,
    unreadOnly: boolean = false,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          fromUser: { select: FROM_USER_SELECT },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification non trouvée');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async delete(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification non trouvée');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  async sendTestNotification(userId: string) {
    return this.create({
      userId,
      type: NotificationType.SYSTEM,
      title: 'Notification de test',
      body: 'Ceci est une notification de test pour vérifier que tout fonctionne correctement.',
      metadata: { test: true, timestamp: new Date().toISOString() },
    });
  }
}
