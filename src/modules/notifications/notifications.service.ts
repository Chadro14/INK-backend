// src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRÉER UNE NOTIFICATION
  // ============================================
  async create(
    userId: string,
    data: {
      type: NotificationType;
      title: string;
      body: string;
      link?: string;
      metadata?: any;
    },
  ) {
    // NETTOYAGE DES EMOJIS SANS SUPPRIMER LES ACCENTS
    const cleanTitle = data.title.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    const cleanBody = data.body.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

    return this.prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: cleanTitle || data.title,
        body: cleanBody || data.body,
        link: data.link || null,
        metadata: data.metadata || null,
      },
    });
  }

  // ============================================
  // RÉCUPÉRER LES NOTIFICATIONS D'UN UTILISATEUR
  // ============================================
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

  // ============================================
  // RÉCUPÉRER LE NOMBRE DE NOTIFICATIONS NON LUES
  // ============================================
  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  // ============================================
  // MARQUER UNE NOTIFICATION COMME LUE
  // ============================================
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

  // ============================================
  // MARQUER TOUTES LES NOTIFICATIONS COMME LUES
  // ============================================
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  // ============================================
  // SUPPRIMER UNE NOTIFICATION
  // ============================================
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

  // ============================================
  // SUPPRIMER TOUTES LES NOTIFICATIONS D'UN UTILISATEUR
  // ============================================
  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  // ============================================
  // TEST - ENVOYER UNE NOTIFICATION DE TEST
  // ============================================
  async sendTestNotification(userId: string) {
    return this.create(userId, {
      type: NotificationType.SYSTEM,
      title: '🔔 Notification de test',
      body: 'Ceci est une notification de test pour vérifier que tout fonctionne correctement.',
      metadata: { test: true, timestamp: new Date().toISOString() },
    });
  }
}
