import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

const USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  avatarColor: true,
  isCertified: true,
  badgeColor: true,
};

const MANGA_SELECT = {
  id: true,
  title: true,
  slug: true,
  coverUrl: true,
};

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // ENVOYER UN MESSAGE (avec manga optionnel)
  // ============================================
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    mangaId?: string,
  ) {
    if ((!content || !content.trim()) && !mangaId) {
      throw new BadRequestException(
        'Le message doit contenir du texte ou un manga',
      );
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new NotFoundException('Conversation non trouvée');

    if (
      conversation.user1Id !== senderId &&
      conversation.user2Id !== senderId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette conversation",
      );
    }

    // Si mangaId fourni : vérifier que le sender est bien l'auteur du manga
    if (mangaId) {
      const manga = await this.prisma.manga.findUnique({
        where: { id: mangaId },
        select: { authorId: true },
      });

      if (!manga) {
        throw new NotFoundException('Manga non trouvé');
      }

      if (manga.authorId !== senderId) {
        throw new ForbiddenException(
          'Vous ne pouvez partager que vos propres mangas',
        );
      }
    }

    const receiverId =
      conversation.user1Id === senderId
        ? conversation.user2Id
        : conversation.user1Id;

    const trimmedContent = content?.trim() || '';
    const preview = mangaId
      ? `${trimmedContent || 'Manga partagé'}`.slice(0, 100)
      : trimmedContent.slice(0, 100);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          senderId,
          receiverId,
          conversationId,
          content: trimmedContent,
          mangaId: mangaId || null,
        },
        include: {
          sender: { select: USER_SELECT },
          manga: { select: MANGA_SELECT },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
        },
      }),
    ]);

    // Notifier le receiver
    await this.notificationsService.create({
      userId: receiverId,
      fromUserId: senderId,
      type: NotificationType.NEW_MESSAGE,
      title: 'Nouveau message',
      body: `@${message.sender.username} vous a envoyé un message`,
      link: `/chat/${conversationId}`,
      metadata: { conversationId, messageId: message.id },
    });

    return message;
  }

  // ============================================
  // RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION
  // ============================================
  async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new NotFoundException('Conversation non trouvée');

    if (
      conversation.user1Id !== userId &&
      conversation.user2Id !== userId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette conversation",
      );
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: USER_SELECT },
          manga: { select: MANGA_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    // Marquer comme lus tous les messages reçus
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      data: messages.reverse(),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // MARQUER COMME LU
  // ============================================
  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }

  // ============================================
  // COMPTER LES MESSAGES NON LUS
  // ============================================
  async countUnread(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
        conversationId: { not: null },
      },
    });

    return { count };
  }
}
