import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowService } from '../follow/follow.service';
import { CertificationService } from '../certification/certification.service';
import { CertifyUserDto } from './dto/certify-user.dto';
import { ModerateContentDto, ModerationAction } from './dto/moderate-content.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { PremiumPlan } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private followService: FollowService,
    private certificationService: CertificationService,
  ) {}

  // ============================================
  // VÉRIFIER SI L'UTILISATEUR EST ADMIN
  // ============================================
  async checkAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Accès refusé. Vous devez être administrateur.');
    }

    return user;
  }

  // ============================================
  // LISTE DES UTILISATEURS
  // ============================================
  async getUsers(filter: UserFilterDto) {
    const { search, isCertified, isVerified, role, page, limit } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isCertified !== undefined) {
      where.isCertified = isCertified;
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
          role: true,
          isCertified: true,
          premiumActive: true,
          createdAt: true,
          _count: {
            select: {
              mangas: true,
              followers: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // CERTIFIER UN UTILISATEUR (manuel)
  // ============================================
  async certifyUser(adminId: string, dto: CertifyUserDto) {
    await this.checkAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        isCertified: dto.certify,
        certifiedAt: dto.certify ? new Date() : null,
        avatarColor: dto.badgeColor || user.avatarColor,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: dto.certify ? 'USER_CERTIFIED' : 'USER_UNCERTIFIED',
        targetId: dto.userId,
        targetType: 'User',
        details: { reason: dto.reason },
      },
    });

    if (dto.certify) {
      await this.prisma.notification.create({
        data: {
          userId: dto.userId,
          type: 'CERTIFICATION',
          title: '🎉 Félicitations !',
          body: 'Vous avez été certifié par l\'équipe INKDROP ⭐',
        },
      });
    }

    return updatedUser;
  }

  // ============================================
  // ✅ AJOUTER UN ABONNEMENT PREMIUM À UN UTILISATEUR (PAR ADMIN)
  // ============================================
  async grantPremiumSubscription(adminId: string, userId: string, plan: PremiumPlan = PremiumPlan.MONTHLY, durationMonths: number = 1) {
    await this.checkAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    const currentExpires = user.premiumExpires || new Date();
    const newExpires = currentExpires > new Date() 
      ? new Date(currentExpires.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000)
      : expiresAt;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        premiumActive: true,
        premiumExpires: newExpires,
        premiumPlan: plan,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'PREMIUM_GRANTED',
        targetId: userId,
        targetType: 'User',
        details: { 
          plan, 
          durationMonths, 
          expiresAt: newExpires,
        },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: '👑 Abonnement Premium offert !',
        body: `Vous avez reçu un abonnement Premium de ${durationMonths} mois de la part de l'équipe INKDROP.`,
        metadata: { plan, durationMonths, expiresAt: newExpires },
      },
    });

    return {
      success: true,
      message: `Abonnement Premium ${plan} de ${durationMonths} mois accordé à ${user.username}`,
      user: updatedUser,
    };
  }

  // ============================================
  // ✅ PROMOUVOIR UN UTILISATEUR EN DESSINATEUR
  // ============================================
  async promoteToCreator(adminId: string, userId: string) {
    await this.checkAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role === 'CREATOR') {
      throw new BadRequestException('Cet utilisateur est déjà un créateur');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Un administrateur ne peut pas être promu créateur');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'CREATOR' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_PROMOTED_TO_CREATOR',
        targetId: userId,
        targetType: 'User',
        details: { previousRole: user.role },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: '🎨 Vous êtes maintenant un créateur !',
        body: 'Vous pouvez maintenant publier des mangas payants et gagner de l\'argent. Félicitations !',
        metadata: { role: 'CREATOR' },
      },
    });

    return {
      success: true,
      message: `L'utilisateur ${user.username} est maintenant un créateur`,
      user: updatedUser,
    };
  }

  // ============================================
  // ✅ RÉVOQUER LE STATUT DE DESSINATEUR
  // ============================================
  async revokeCreatorStatus(adminId: string, userId: string, reason: string) {
    await this.checkAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role !== 'CREATOR') {
      throw new BadRequestException('Cet utilisateur n\'est pas un créateur');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'READER' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_STATUS_REVOKED',
        targetId: userId,
        targetType: 'User',
        details: { reason },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: '❌ Statut de créateur révoqué',
        body: `Votre statut de créateur a été révoqué. Raison : ${reason}`,
        metadata: { reason },
      },
    });

    return {
      success: true,
      message: `Le statut de créateur de ${user.username} a été révoqué`,
      user: updatedUser,
    };
  }

  // ============================================
  // ✅ LISTE DES DEMANDES DE DESSINATEUR
  // ============================================
  async getCreatorRequests(adminId: string, status?: string, page: number = 1, limit: number = 20) {
    await this.checkAdmin(adminId);

    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      this.prisma.creatorRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creatorRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // ✅ APPOUVER UNE DEMANDE DE DESSINATEUR
  // ============================================
  async approveCreatorRequest(adminId: string, requestId: string, reviewNotes?: string) {
    await this.checkAdmin(adminId);

    const request = await this.prisma.creatorRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    await this.prisma.creatorRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewNotes: reviewNotes || null,
      },
    });

    await this.prisma.user.update({
      where: { id: request.userId },
      data: { role: 'CREATOR' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_REQUEST_APPROVED',
        targetId: requestId,
        targetType: 'CreatorRequest',
        details: { userId: request.userId, username: request.user.username },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'SYSTEM',
        title: '🎨 Félicitations !',
        body: 'Votre demande de créateur a été approuvée. Vous pouvez maintenant publier des mangas payants et gagner de l\'argent !',
        metadata: { role: 'CREATOR' },
      },
    });

    return {
      success: true,
      message: `La demande de ${request.user.username} a été approuvée`,
    };
  }

  // ============================================
  // ✅ REFUSER UNE DEMANDE DE DESSINATEUR
  // ============================================
  async rejectCreatorRequest(adminId: string, requestId: string, reason: string) {
    await this.checkAdmin(adminId);

    const request = await this.prisma.creatorRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    await this.prisma.creatorRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewNotes: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CREATOR_REQUEST_REJECTED',
        targetId: requestId,
        targetType: 'CreatorRequest',
        details: { userId: request.userId, username: request.user.username, reason },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        type: 'SYSTEM',
        title: '❌ Demande de créateur refusée',
        body: `Votre demande de créateur a été refusée. Raison : ${reason}`,
        metadata: { reason },
      },
    });

    return {
      success: true,
      message: `La demande de ${request.user.username} a été refusée`,
    };
  }

  // ============================================
  // MODÉRATION DU CONTENU
  // ============================================
  async moderateContent(adminId: string, dto: ModerateContentDto) {
    await this.checkAdmin(adminId);

    const { targetId, action, reason } = dto;

    const comment = await this.prisma.comment.findUnique({
      where: { id: targetId },
    });

    if (comment) {
      await this.prisma.comment.update({
        where: { id: targetId },
        data: {
          status: action === ModerationAction.DELETE ? 'DELETED' : 'HIDDEN',
          content: action === ModerationAction.DELETE ? '[Commentaire supprimé]' : comment.content,
        },
      });
    } else {
      const manga = await this.prisma.manga.findUnique({
        where: { id: targetId },
      });

      if (manga) {
        await this.prisma.manga.update({
          where: { id: targetId },
          data: {
            status: action === ModerationAction.DELETE ? 'HIATUS' : 'ONGOING',
          },
        });
      } else {
        throw new NotFoundException('Contenu non trouvé');
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `CONTENT_${action}`,
        targetId,
        targetType: comment ? 'Comment' : 'Manga',
        details: { reason },
      },
    });

    return { success: true, message: `Contenu ${action} avec succès` };
  }

  // ============================================
  // STATISTIQUES GLOBALES
  // ============================================
  async getStats(adminId: string) {
    await this.checkAdmin(adminId);

    const [
      totalUsers,
      totalMangas,
      totalChapters,
      totalComments,
      totalPayments,
      totalRevenue,
      totalCreatorRequests,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.manga.count(),
      this.prisma.chapter.count(),
      this.prisma.comment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.count({ where: { status: 'SUCCESS' } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.creatorRequest.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        creators: await this.prisma.user.count({ where: { role: 'CREATOR' } }),
        certified: await this.prisma.user.count({ where: { isCertified: true } }),
        premium: await this.prisma.user.count({ where: { premiumActive: true } }),
      },
      content: {
        mangas: totalMangas,
        chapters: totalChapters,
        comments: totalComments,
      },
      payments: {
        total: totalPayments,
        revenue: totalRevenue._sum.amount || 0,
      },
      requests: {
        pending: totalCreatorRequests,
      },
    };
  }

  // ============================================
  // SUSPENDRE UN UTILISATEUR
  // ============================================
  async suspendUser(adminId: string, userId: string, reason: string) {
    await this.checkAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isSuspended = user.role === 'SUSPENDED';

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: isSuspended ? 'READER' : 'SUSPENDED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: isSuspended ? 'USER_UNSUSPENDED' : 'USER_SUSPENDED',
        targetId: userId,
        targetType: 'User',
        details: { reason },
      },
    });

    if (!isSuspended) {
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: '⚠️ Compte suspendu',
          body: `Votre compte a été suspendu. Raison : ${reason}`,
        },
      });
    }

    return updatedUser;
  }
}
