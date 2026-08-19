// src/modules/ai/tools.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class ToolsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ============================================
  // 1. BANNIR UN UTILISATEUR
  // ============================================
  async banUser(
    dto: { userId: string; reason: string; permanent?: boolean; duration?: '1d' | '7d' | '30d' | 'permanent' },
    adminId?: string
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (user.role === 'ADMIN') throw new ForbiddenException('Impossible de bannir un administrateur');
    if (user.role === 'BANNED') return { success: false, message: 'Déjà banni' };

    const updated = await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        role: 'BANNED',
        banReason: dto.reason,
        bannedAt: new Date(),
        bannedBy: adminId || 'Xelira (IA)',
        isLocked: true,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'SYSTEM',
        title: '⚠️ Compte banni',
        body: `Votre compte a été banni. Raison : ${dto.reason}`,
      },
    });

    return {
      success: true,
      message: `Utilisateur ${user.username} banni`,
      data: { userId: updated.id, username: updated.username, reason: dto.reason, bannedAt: updated.bannedAt },
    };
  }

  // ============================================
  // 2. SUPPRIMER UN COMMENTAIRE
  // ============================================
  async deleteComment(dto: { commentId: string; reason?: string }, adminId?: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: dto.commentId },
      include: { user: true },
    });
    if (!comment) throw new NotFoundException('Commentaire non trouvé');

    await this.prisma.comment.update({
      where: { id: dto.commentId },
      data: { status: 'DELETED', content: '[Commentaire supprimé par Xelira]' },
    });

    return {
      success: true,
      message: 'Commentaire supprimé',
      data: { commentId: comment.id, userId: comment.userId, username: comment.user.username },
    };
  }

  // ============================================
  // 3. AVERTIR UN UTILISATEUR
  // ============================================
  async warnUser(dto: { userId: string; message: string }, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const warnings = (user as any).warningsCount || 0;
    const newWarnings = warnings + 1;

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { warningsCount: newWarnings },
    });

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'SYSTEM',
        title: `⚠️ Avertissement #${newWarnings}`,
        body: `Vous avez reçu un avertissement : ${dto.message}`,
      },
    });

    let autoBanned = false;
    if (newWarnings >= 3) {
      await this.banUser({
        userId: dto.userId,
        reason: '3 avertissements consécutifs',
        permanent: false,
        duration: '7d',
      }, adminId);
      autoBanned = true;
    }

    return {
      success: true,
      message: `Avertissement #${newWarnings} envoyé`,
      data: { userId: user.id, username: user.username, warnings: newWarnings, autoBanned },
    };
  }

  // ============================================
  // 4. PROFIL UTILISATEUR
  // ============================================
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isCertified: true,
        isLocked: true,
        failedLoginAttempts: true,
        createdAt: true,
        warningsCount: true,
        banReason: true,
        bannedAt: true,
        _count: { select: { comments: true, mangas: true, followers: true } },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return { success: true, data: { ...user, reportsCount: 0 } };
  }

  // ============================================
  // 5. CONTENU SIGNALÉ
  // ============================================
  async getReportedContent() {
    const reported = await this.prisma.comment.findMany({
      where: { isReported: true, status: 'ACTIVE' },
      include: { user: { select: { id: true, username: true } }, manga: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    return { success: true, message: `${reported.length} contenus signalés`, data: reported };
  }
}