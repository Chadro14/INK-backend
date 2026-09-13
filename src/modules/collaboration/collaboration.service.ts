import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ManasTransactionType,
  NotificationType,
  CollaborationStatus,
} from '@prisma/client';
import { MANAS_CONFIG } from '../../common/constants/manas.config';

const USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  avatarColor: true,
  isCertified: true,
  badgeColor: true,
};

@Injectable()
export class CollaborationService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ============================================
  // 1. CRÉER UNE DEMANDE DE COLLABORATION
  // ============================================
  async createRequest(
    senderId: string,
    receiverId: string,
    message?: string,
  ) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'Vous ne pouvez pas collaborer avec vous-même',
      );
    }

    const [sender, receiver] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, manas: true, premiumActive: true },
      }),
      this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true, username: true, role: true },
      }),
    ]);

    if (!sender) throw new NotFoundException('Expéditeur non trouvé');
    if (!receiver) throw new NotFoundException('Destinataire non trouvé');

    if (receiver.role !== 'CREATOR' && receiver.role !== 'ADMIN') {
      throw new BadRequestException(
        "Cet utilisateur n'est pas un créateur",
      );
    }

    const amount = MANAS_CONFIG.COLLABORATION_COST;

    if (sender.manas < amount) {
      throw new BadRequestException(
        `Solde insuffisant (${amount} MANAS requis)`,
      );
    }

    const existingPending = await this.prisma.collaborationRequest.findFirst({
      where: {
        senderId,
        receiverId,
        status: CollaborationStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'Vous avez déjà une demande de collaboration en attente avec ce créateur',
      );
    }

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: senderId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: senderId },
        ],
      },
    });

    if (existingConversation) {
      throw new BadRequestException(
        'Vous collaborez déjà avec ce créateur',
      );
    }

    const expiresAt = new Date(
      Date.now() +
        MANAS_CONFIG.COLLABORATION_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: senderId },
        data: { manas: { decrement: amount } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: senderId,
          amount: -amount,
          type: ManasTransactionType.COLLABORATION,
          description: `Demande de collaboration à ${receiver.username} (en attente)`,
          metadata: { receiverId, receiverUsername: receiver.username },
        },
      });

      const request = await tx.collaborationRequest.create({
        data: {
          senderId,
          receiverId,
          amountManas: amount,
          message: message || null,
          status: CollaborationStatus.PENDING,
          expiresAt,
        },
        include: {
          sender: { select: USER_SELECT },
          receiver: { select: USER_SELECT },
        },
      });

      return request;
    });

    await this.notificationsService.create({
      userId: receiverId,
      fromUserId: senderId,
      type: NotificationType.COLLABORATION_REQUEST,
      title: 'Nouvelle demande de collaboration',
      body: `@${sender.username} souhaite collaborer avec vous (${amount} MANAS)`,
      link: `/collaborations`,
      metadata: { requestId: result.id, amount },
    });

    return result;
  }

  // ============================================
  // 2. ACCEPTER UNE DEMANDE
  // ============================================
  async acceptRequest(userId: string, requestId: string) {
    const request = await this.prisma.collaborationRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
    });

    if (!request) throw new NotFoundException('Demande non trouvée');

    if (request.receiverId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le destinataire de cette demande",
      );
    }

    if (request.status !== CollaborationStatus.PENDING) {
      throw new BadRequestException(
        `Cette demande est déjà ${request.status.toLowerCase()}`,
      );
    }

    if (request.expiresAt < new Date()) {
      throw new BadRequestException('Cette demande a expiré');
    }

    const amount = request.amountManas;
    const creatorShare = Math.floor(amount * MANAS_CONFIG.CREATOR_SHARE);
    const platformShare = amount - creatorShare;

    const platformAccount = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, username: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.receiverId },
        data: { manas: { increment: creatorShare } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: request.receiverId,
          amount: creatorShare,
          type: ManasTransactionType.COLLABORATION,
          description: `Collaboration acceptée avec ${request.sender.username}`,
          metadata: { senderId: request.senderId, requestId: request.id },
        },
      });

      if (platformAccount) {
        await tx.user.update({
          where: { id: platformAccount.id },
          data: { manas: { increment: platformShare } },
        });

        await tx.manasTransaction.create({
          data: {
            userId: platformAccount.id,
            amount: platformShare,
            type: ManasTransactionType.COLLABORATION,
            description: `Commission plateforme (30% de ${amount} MANAS)`,
            metadata: {
              requestId: request.id,
              senderId: request.senderId,
              receiverId: request.receiverId,
            },
          },
        });
      }

      const updated = await tx.collaborationRequest.update({
        where: { id: requestId },
        data: {
          status: CollaborationStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      const [user1Id, user2Id] =
        request.senderId < request.receiverId
          ? [request.senderId, request.receiverId]
          : [request.receiverId, request.senderId];

      const conversation = await tx.conversation.create({
        data: {
          collaborationId: request.id,
          user1Id,
          user2Id,
        },
      });

      return { request: updated, conversation };
    });

    await this.notificationsService.create({
      userId: request.senderId,
      fromUserId: userId,
      type: NotificationType.COLLABORATION_ACCEPTED,
      title: 'Collaboration acceptée',
      body: `@${request.receiver.username} a accepté votre demande de collaboration`,
      link: `/chat/${result.conversation.id}`,
      metadata: {
        requestId: request.id,
        conversationId: result.conversation.id,
      },
    });

    return result;
  }

  // ============================================
  // 3. REFUSER UNE DEMANDE
  // ============================================
  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prisma.collaborationRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
    });

    if (!request) throw new NotFoundException('Demande non trouvée');

    if (request.receiverId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le destinataire de cette demande",
      );
    }

    if (request.status !== CollaborationStatus.PENDING) {
      throw new BadRequestException(
        `Cette demande est déjà ${request.status.toLowerCase()}`,
      );
    }

    const amount = request.amountManas;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.senderId },
        data: { manas: { increment: amount } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: request.senderId,
          amount,
          type: ManasTransactionType.COLLABORATION,
          description: `Remboursement — demande refusée par ${request.receiver.username}`,
          metadata: { requestId: request.id, receiverId: request.receiverId },
        },
      });

      await tx.collaborationRequest.update({
        where: { id: requestId },
        data: {
          status: CollaborationStatus.REJECTED,
          respondedAt: new Date(),
          refundedAt: new Date(),
        },
      });
    });

    await this.notificationsService.create({
      userId: request.senderId,
      fromUserId: userId,
      type: NotificationType.COLLABORATION_REJECTED,
      title: 'Collaboration refusée',
      body: `@${request.receiver.username} a refusé votre demande. ${amount} MANAS vous ont été remboursés.`,
      link: `/collaborations`,
      metadata: { requestId: request.id },
    });

    return { success: true, message: 'Demande refusée et remboursée' };
  }

  // ============================================
  // 4. ANNULER SA PROPRE DEMANDE
  // ============================================
  async cancelRequest(userId: string, requestId: string) {
    const request = await this.prisma.collaborationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Demande non trouvée');

    if (request.senderId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas l'expéditeur de cette demande",
      );
    }

    if (request.status !== CollaborationStatus.PENDING) {
      throw new BadRequestException(
        `Cette demande est déjà ${request.status.toLowerCase()}`,
      );
    }

    const amount = request.amountManas;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.senderId },
        data: { manas: { increment: amount } },
      });

      await tx.manasTransaction.create({
        data: {
          userId: request.senderId,
          amount,
          type: ManasTransactionType.COLLABORATION,
          description: `Remboursement — demande annulée`,
          metadata: { requestId: request.id },
        },
      });

      await tx.collaborationRequest.update({
        where: { id: requestId },
        data: {
          status: CollaborationStatus.CANCELLED,
          respondedAt: new Date(),
          refundedAt: new Date(),
        },
      });
    });

    return { success: true, message: 'Demande annulée et remboursée' };
  }

  // ============================================
  // 5. DEMANDES REÇUES
  // ============================================
  async getReceivedRequests(userId: string) {
    return this.prisma.collaborationRequest.findMany({
      where: { receiverId: userId },
      include: { sender: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // 6. DEMANDES ENVOYÉES
  // ============================================
  async getSentRequests(userId: string) {
    return this.prisma.collaborationRequest.findMany({
      where: { senderId: userId },
      include: { receiver: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // 7. MES CONVERSATIONS
  // ============================================
  async getMyConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: USER_SELECT },
        user2: { select: USER_SELECT },
        collaboration: {
          select: { id: true, amountManas: true, createdAt: true },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });

    return conversations.map((c) => ({
      id: c.id,
      otherUser: c.user1Id === userId ? c.user2 : c.user1,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      collaboration: c.collaboration,
    }));
  }

  // ============================================
  // 8. DÉTAIL D'UNE CONVERSATION
  // ============================================
  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: { select: USER_SELECT },
        user2: { select: USER_SELECT },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation non trouvée');

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette conversation",
      );
    }

    return {
      id: conversation.id,
      otherUser:
        conversation.user1Id === userId
          ? conversation.user2
          : conversation.user1,
      createdAt: conversation.createdAt,
    };
  }

  // ============================================
  // 9. EXPIRER LES DEMANDES (appelé par le cron)
  // ============================================
  async expireOldRequests() {
    const now = new Date();

    const expiredRequests = await this.prisma.collaborationRequest.findMany({
      where: {
        status: CollaborationStatus.PENDING,
        expiresAt: { lt: now },
      },
    });

    for (const request of expiredRequests) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: request.senderId },
          data: { manas: { increment: request.amountManas } },
        });

        await tx.manasTransaction.create({
          data: {
            userId: request.senderId,
            amount: request.amountManas,
            type: ManasTransactionType.COLLABORATION,
            description: `Remboursement — demande expirée`,
            metadata: { requestId: request.id },
          },
        });

        await tx.collaborationRequest.update({
          where: { id: request.id },
          data: {
            status: CollaborationStatus.EXPIRED,
            respondedAt: now,
            refundedAt: now,
          },
        });
      });

      await this.notificationsService.create({
        userId: request.senderId,
        type: NotificationType.SYSTEM,
        title: 'Demande de collaboration expirée',
        body: `Votre demande de collaboration a expiré. ${request.amountManas} MANAS vous ont été remboursés.`,
        link: `/collaborations`,
        metadata: { requestId: request.id },
      });
    }

    return { expired: expiredRequests.length };
  }

  // ============================================
  // 10. COMPTE POUR LE BADGE DU PROFIL
  //     = demandes PENDING reçues + messages non lus
  // ============================================
  async getBadgeCount(userId: string) {
    const [pendingRequests, unreadMessages] = await Promise.all([
      this.prisma.collaborationRequest.count({
        where: {
          receiverId: userId,
          status: CollaborationStatus.PENDING,
        },
      }),
      this.prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false,
          conversationId: { not: null },
        },
      }),
    ]);

    return {
      pendingRequests,
      unreadMessages,
      total: pendingRequests + unreadMessages,
    };
  }
}
