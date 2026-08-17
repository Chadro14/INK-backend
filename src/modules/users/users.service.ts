import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR ID
  // ============================================
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        mangas: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR EMAIL
  // ============================================
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR USERNAME
  // ============================================
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        mangas: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  // ============================================
  // METTRE À JOUR UN UTILISATEUR
  // ============================================
  async update(userId: string, data: { username?: string; email?: string; bio?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return user;
  }

  // ============================================
  // METTRE À JOUR L'AVATAR
  // ============================================
  async updateAvatar(userId: string, avatarUrl: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  // ============================================
  // METTRE À JOUR LA COULEUR D'AVATAR
  // ============================================
  async updateAvatarColor(userId: string, avatarColor: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarColor },
    });
  }

  // ============================================
  // GESTION DE LA CERTIFICATION & DU BADGE
  // ============================================
  async updateBadgeColor(userId: string, badgeColor: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.isCertified) {
      throw new ForbiddenException('Seuls les utilisateurs certifiés peuvent personnaliser leur badge');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { badgeColor },
    });
  }

  async setCertification(targetUserId: string, isCertified: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isCertified },
    });
  }

  // ============================================
  // SUPPRIMER UN UTILISATEUR
  // ============================================
  async delete(userId: string) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // ============================================
  // RÉCUPÉRER LES STATISTIQUES
  // ============================================
  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        manas: true,
        steamPoints: true,
        steamLevel: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  // ============================================
  // RÉCUPÉRER LES CRÉATEURS CERTIFIÉS
  // ============================================
  async getTopCreators(limit: number = 6) {
    return this.prisma.user.findMany({
      where: { isCertified: true },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        isCertified: true,
        badgeColor: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
          },
        },
      },
      orderBy: {
        followers: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  // ============================================
  // SAUVEGARDER L'ÉTAT
  // ============================================
  async saveState(userId: string, state: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { appState: state },
    });
  }

  // ============================================
  // CHARGER L'ÉTAT
  // ============================================
  async loadState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appState: true },
    });

    return user?.appState || null;
  }

  // ============================================
  // ✅ CHANGER LE MOT DE PASSE
  // ============================================
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Vérifier que le nouveau mot de passe est différent
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent');
    }

    // Valider la force du mot de passe
    this.validatePasswordStrength(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashedPassword,
          failedLoginAttempts: 0,
          isLocked: false,
        },
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: '🔐 Mot de passe modifié',
          body: 'Votre mot de passe a été modifié avec succès.',
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGED',
        },
      }),
    ]);

    return { success: true, message: 'Mot de passe modifié avec succès' };
  }

  // ============================================
  // ✅ CHANGER L'EMAIL (Étape 1 : Demande)
  // ============================================
  async requestEmailChange(userId: string, newEmail: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe incorrect');
    }

    // Vérifier si l'email est déjà utilisé
    const existing = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Supprimer les anciennes demandes
    await this.prisma.emailChangeRequest.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.emailChangeRequest.create({
      data: {
        userId: user.id,
        newEmail,
        token,
        expiresAt,
      },
    });

    // Envoyer l'email de vérification
    await this.emailService.sendEmailVerification(user.email, token, newEmail);

    return {
      success: true,
      message: 'Un email de vérification a été envoyé à votre nouvelle adresse.',
    };
  }

  // ============================================
  // ✅ CHANGER L'EMAIL (Étape 2 : Confirmation)
  // ============================================
  async confirmEmailChange(token: string) {
    const request = await this.prisma.emailChangeRequest.findUnique({
      where: { token },
    });

    if (!request) {
      throw new BadRequestException('Token invalide');
    }

    if (request.expiresAt < new Date()) {
      await this.prisma.emailChangeRequest.delete({ where: { id: request.id } });
      throw new BadRequestException('Token expiré');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: { email: request.newEmail },
      }),
      this.prisma.emailChangeRequest.delete({
        where: { id: request.id },
      }),
      this.prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'SYSTEM',
          title: '📧 Email modifié',
          body: `Votre adresse email a été modifiée avec succès vers ${request.newEmail}.`,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: request.userId,
          action: 'EMAIL_CHANGED',
          details: { newEmail: request.newEmail },
        },
      }),
    ]);

    return { success: true, message: 'Email modifié avec succès' };
  }

  // ============================================
  // ✅ GESTION DES NOTIFICATIONS
  // ============================================
  async updateNotificationSettings(userId: string, settings: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: settings },
    });
  }

  // ============================================
  // ✅ GESTION DES PRÉFÉRENCES
  // ============================================
  async updatePreferences(userId: string, preferences: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences },
    });
  }

  // ============================================
  // ✅ SUPPRIMER LE COMPTE
  // ============================================
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe incorrect');
    }

    await this.prisma.$transaction([
      this.prisma.userFollow.deleteMany({ where: { followerId: userId } }),
      this.prisma.userFollow.deleteMany({ where: { followingId: userId } }),
      this.prisma.comment.deleteMany({ where: { userId } }),
      this.prisma.commentLike.deleteMany({ where: { userId } }),
      this.prisma.like.deleteMany({ where: { userId } }),
      this.prisma.subscription.deleteMany({ where: { followerId: userId } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.manga.deleteMany({ where: { authorId: userId } }),
      this.prisma.payment.deleteMany({ where: { userId } }),
      this.prisma.creatorEarning.deleteMany({ where: { creatorId: userId } }),
      this.prisma.payout.deleteMany({ where: { creatorId: userId } }),
      this.prisma.message.deleteMany({ where: { senderId: userId } }),
      this.prisma.message.deleteMany({ where: { receiverId: userId } }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.emailChangeRequest.deleteMany({ where: { userId } }),
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { success: true, message: 'Compte supprimé avec succès' };
  }

  // ============================================
  // VALIDATION DE LA FORCE DU MOT DE PASSE
  // ============================================
  private validatePasswordStrength(password: string) {
    const errors = [];

    if (password.length < 8) {
      errors.push('Au moins 8 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Au moins une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Au moins une minuscule');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Au moins un chiffre');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>\/?]/.test(password)) {
      errors.push('Au moins un caractère spécial');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Mot de passe trop faible : ${errors.join(', ')}`
      );
    }
  }
}
