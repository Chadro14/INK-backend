// src/modules/ai/tools.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';
import { BanUserDto, WarnUserDto, DeleteCommentDto } from './dto/moderation.dto';
import { ToolResult, UserProfile, CommentToModerate } from './interfaces/ai-tools.interface';

@Injectable()
export class ToolsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ============================================
  // 1. BANNIR UN UTILISATEUR
  // ============================================
  async banUser(dto: BanUserDto, adminId?: string): Promise<ToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Impossible de bannir un administrateur');
    }

    if (user.role === 'BANNED') {
      return {
        success: false,
        message: 'Cet utilisateur est déjà banni',
        error: 'ALREADY_BANNED',
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        role: 'BANNED',
        banReason: dto.reason,
        bannedAt: new Date(),
        bannedBy: adminId || 'Xelira (IA)',
        isLocked: true,
      },
    });

    // Envoyer une notification à l'utilisateur banni
    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'SYSTEM',
        title: '⚠️ Compte banni',
        body: `Votre compte a été banni. Raison : ${dto.reason}`,
      },
    });

    // Log de l'action
    await this.prisma.auditLog.create({
      data: {
        userId: adminId || 'Xelira (IA)',
        action: 'USER_BANNED',
        targetId: dto.userId,
        details: { reason: dto.reason, permanent: dto.permanent, duration: dto.duration },
      },
    });

    return {
      success: true,
      message: `Utilisateur ${user.username} banni avec succès`,
      data: {
        userId: updatedUser.id,
        username: updatedUser.username,
        reason: dto.reason,
        bannedAt: updatedUser.bannedAt,
      },
    };
  }

  // ============================================
  // 2. SUPPRIMER UN COMMENTAIRE
  // ============================================
  async deleteComment(dto: DeleteCommentDto, adminId?: string): Promise<ToolResult> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: dto.commentId },
      include: { user: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    // Sauvegarder le contenu original pour l'audit
    const originalContent = comment.content;

    const updatedComment = await this.prisma.comment.update({
      where: { id: dto.commentId },
      data: {
        status: 'DELETED',
        content: '[Commentaire supprimé par Xelira (IA)]',
      },
    });

    // Notification à l'utilisateur
    await this.prisma.notification.create({
      data: {
        userId: comment.userId,
        type: 'SYSTEM',
        title: '🗑️ Commentaire supprimé',
        body: `Votre commentaire a été supprimé par Xelira. Raison : ${dto.reason || 'Contenu inapproprié'}`,
      },
    });

    // Log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId || 'Xelira (IA)',
        action: 'COMMENT_DELETED_BY_AI',
        targetId: dto.commentId,
        details: { reason: dto.reason, originalContent },
      },
    });

    return {
      success: true,
      message: 'Commentaire supprimé avec succès',
      data: {
        commentId: updatedComment.id,
        userId: comment.userId,
        username: comment.user.username,
      },
    };
  }

  // ============================================
  // 3. AVERTIR UN UTILISATEUR
  // ============================================
  async warnUser(dto: WarnUserDto, adminId?: string): Promise<ToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Incrémenter le compteur d'avertissements
    const warnings = user.warningsCount || 0;
    const newWarnings = warnings + 1;

    const updatedUser = await this.prisma.user.update({
      where: { id: dto.userId },
      data: {
        warningsCount: newWarnings,
      },
    });

    // Notification
    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'SYSTEM',
        title: `⚠️ Avertissement #${newWarnings}`,
        body: `Vous avez reçu un avertissement de Xelira. ${dto.message}`,
      },
    });

    // Log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId || 'Xelira (IA)',
        action: 'USER_WARNED',
        targetId: dto.userId,
        details: { message: dto.message, warnings: newWarnings },
      },
    });

    // Si 3 avertissements, bannir automatiquement
    if (newWarnings >= 3) {
      await this.banUser({
        userId: dto.userId,
        reason: '3 avertissements consécutifs',
        permanent: false,
        duration: '7d',
      }, adminId);

      return {
        success: true,
        message: `Utilisateur ${user.username} a reçu son 3ème avertissement et a été banni automatiquement`,
        data: {
          userId: updatedUser.id,
          username: updatedUser.username,
          warnings: newWarnings,
          autoBanned: true,
        },
      };
    }

    return {
      success: true,
      message: `Avertissement #${newWarnings} envoyé à ${user.username}`,
      data: {
        userId: updatedUser.id,
        username: updatedUser.username,
        warnings: newWarnings,
        autoBanned: false,
      },
    };
  }

  // ============================================
  // 4. RÉCUPÉRER LE PROFIL D'UN UTILISATEUR
  // ============================================
  async getUserProfile(userId: string, adminId?: string): Promise<ToolResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isCertified: true,
        isLocked: true,
        failedLoginAttempts: true,
        createdAt: true,
        warningsCount: true,
        banReason: true,
        bannedAt: true,
        _count: {
          select: {
            comments: true,
            mangas: true,
            followers: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      success: true,
      message: 'Profil récupéré avec succès',
      data: {
        ...user,
        reportsCount: await this.prisma.report.count({ where: { targetId: userId } }),
      },
    };
  }

  // ============================================
  // 5. RÉCUPÉRER LES COMMENTAIRES D'UN UTILISATEUR
  // ============================================
  async getUserComments(userId: string, limit: number = 50): Promise<ToolResult> {
    const comments = await this.prisma.comment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        status: true,
        mangaId: true,
        chapterId: true,
      },
    });

    return {
      success: true,
      message: `${comments.length} commentaires récupérés`,
      data: comments,
    };
  }

  // ============================================
  // 6. RÉCUPÉRER LE CONTENU SIGNALÉ
  // ============================================
  async getReportedContent(): Promise<ToolResult> {
    // Si tu as un modèle Report, sinon, on cherche les commentaires signalés
    const reportedComments = await this.prisma.comment.findMany({
      where: { isReported: true, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        manga: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    return {
      success: true,
      message: `${reportedComments.length} contenus signalés trouvés`,
      data: reportedComments,
    };
  }

  // ============================================
  // 7. VÉRIFIER SI UN COMPTE EST BANNI
  // ============================================
  async isUserBanned(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'BANNED';
  }
}