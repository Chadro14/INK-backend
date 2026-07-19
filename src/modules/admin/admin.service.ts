import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowService } from '../follow/follow.service';
import { CertificationService } from '../certification/certification.service';
import { CertifyUserDto } from './dto/certify-user.dto';
import { ModerateContentDto, ModerationAction } from './dto/moderate-content.dto';
import { UserFilterDto } from './dto/user-filter.dto';

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

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: dto.certify ? 'USER_CERTIFIED' : 'USER_UNCERTIFIED',
        targetId: dto.userId,
        targetType: 'User',
        details: { reason: dto.reason },
      },
    });

    // Notification
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
  // MODÉRATION DU CONTENU
  // ============================================
  async moderateContent(adminId: string, dto: ModerateContentDto) {
    await this.checkAdmin(adminId);

    const { targetId, action, reason } = dto;

    // Déterminer le type de contenu
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
      // Vérifier si c'est un manga
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

    // Audit log
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