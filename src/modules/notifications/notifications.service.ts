import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  // ============================================
  // CRÉER UNE NOTIFICATION (sans emojis)
  // ============================================
  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
    metadata?: any;
  }) {
    // ✅ Supprimer les emojis du titre et du body
    const cleanTitle = data.title.replace(/[^\w\s.,!?]/g, '').trim();
    const cleanBody = data.body ? data.body.replace(/[^\w\s.,!?]/g, '').trim() : undefined;

    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        title: cleanTitle,
        body: cleanBody,
        link: data.link,
        metadata: data.metadata,
      },
    });

    // Envoyer en temps réel via WebSocket
    this.gateway.sendNotification(data.userId, notification);

    return notification;
  }

  // ============================================
  // RÉCUPÉRER LES NOTIFICATIONS
  // ============================================
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // MARQUER COMME LUE
  // ============================================
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });
  }

  // ============================================
  // COMPTER LES NOTIFICATIONS NON LUES
  // ============================================
  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }
}