// src/modules/security/security.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // 1. DEMANDER LA RÉINITIALISATION
  // ============================================
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // ✅ SÉCURITÉ : Ne pas révéler si l'email existe ou non
    if (!user) {
      return {
        success: true,
        message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
      };
    }

    // Supprimer les anciens tokens
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Générer un token sécurisé
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // TODO: Envoyer l'email avec Nodemailer
    // await this.emailService.sendResetEmail(user.email, user.username, token);

    return {
      success: true,
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    };
  }

  // ============================================
  // 2. VÉRIFIER LA VALIDITÉ DU TOKEN
  // ============================================
  async verifyResetToken(token: string) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!reset) {
      return { valid: false, message: 'Token invalide.' };
    }

    if (reset.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: reset.id } });
      return { valid: false, message: 'Token expiré.' };
    }

    return { valid: true, userId: reset.userId };
  }

  // ============================================
  // 3. RÉINITIALISER LE MOT DE PASSE
  // ============================================
  async resetPassword(token: string, newPassword: string) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!reset) {
      throw new BadRequestException('Token invalide.');
    }

    if (reset.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: reset.id } });
      throw new BadRequestException('Token expiré. Veuillez refaire une demande.');
    }

    // ✅ VÉRIFIER LA FORCE DU MOT DE PASSE
    this.validatePasswordStrength(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: hashedPassword,
          failedLoginAttempts: 0,
          isLocked: false,
        },
      }),
      this.prisma.passwordReset.delete({
        where: { id: reset.id },
      }),
      this.prisma.notification.create({
        data: {
          userId: reset.userId,
          type: 'SYSTEM',
          title: '🔐 Mot de passe réinitialisé',
          body: 'Votre mot de passe a été modifié avec succès. Si vous n\'êtes pas à l\'origine de cette action, contactez immédiatement le support.',
        },
      }),
    ]);

    return { success: true };
  }

  // ============================================
  // 4. VALIDER LA FORCE DU MOT DE PASSE
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

  // ============================================
  // 5. GESTION DES TENTATIVES DE CONNEXION
  // ============================================
  async handleFailedLogin(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return;

    const attempts = user.failedLoginAttempts + 1;

    if (attempts >= 5) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          isLocked: true,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: '⚠️ Compte verrouillé',
          body: 'Votre compte a été verrouillé après 5 tentatives de connexion échouées. Utilisez "Mot de passe oublié" pour le déverrouiller.',
        },
      });

      throw new BadRequestException('Compte verrouillé après 5 tentatives. Utilisez "Mot de passe oublié".');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts },
    });
  }

  async handleSuccessfulLogin(userId: string, ip: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lastLoginAt: new Date(),
        lastLoginIP: ip,
      },
    });
  }
}
