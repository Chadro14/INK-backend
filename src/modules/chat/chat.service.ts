import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const receiver = await this.prisma.user.findUnique({
      where: { id: dto.receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('Destinataire non trouvé');
    }

    if (senderId === dto.receiverId) {
      throw new BadRequestException('Vous ne pouvez pas vous envoyer un message à vous-même');
    }

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        content: dto.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
    });

    // ✅ Notification sans emojis
    await this.prisma.notification.create({
      data: {
        userId: dto.receiverId,
        type: 'SYSTEM',
        title: 'Nouveau message',
        body: `${message.sender.username} vous a envoyé un message`,
        metadata: { messageId: message.id, senderId },
      },
    });

    return message;
  }

  async getConversation(userId: string, otherUserId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    await this.prisma.message.updateMany({
      where: {
        senderId: otherUserId,
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

  async getConversations(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['senderId', 'receiverId'],
    });

    const conversations = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const other = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversations.has(otherId)) {
        conversations.set(otherId, {
          user: other,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      if (msg.receiverId === userId && !msg.isRead) {
        conversations.get(otherId).unreadCount += 1;
      }
    }

    return Array.from(conversations.values());
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanOldMessages() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.message.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    console.log(`🗑️ ${result.count} anciens messages supprimés`);
    return result;
  }
}