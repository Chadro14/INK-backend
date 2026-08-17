// src/modules/security/security.service.ts
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SecurityService {
  // Rate limiting pour les demandes de réinitialisation
  private readonly resetAttempts = new Map<string, { count: number; lastAttempt: number }>();

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwtService: JwtService,
  ) {}

  // ============================================
  // 1. DEMANDER LA RÉINITIALISATION (AVEC RATE LIMIT)
  // ============================================
  async requestPasswordReset(email: string, ip: string, userAgent: string) {
    // RATE LIMITING
    const key = `${email}:${ip}`;
    const attempts = this.resetAttempts.get(key);

    if (attempts) {
      if (attempts.count >= 5) {
        throw new BadRequestException(
          'Trop de tentatives. Veuillez attendre 1 heure.'
        );
      }
      if (Date.now() - attempts.lastAttempt < 60000) {
        throw new BadRequestException(
          'Veuillez attendre 1 minute entre chaque demande.'
        );
      }
    }

    this.resetAttempts.set(key, {
      count: (attempts?.count || 0) + 1,
      lastAttempt: Date.now(),
    });

    // Nettoyer après 1 heure
    setTimeout(() => {
      this.resetAttempts.delete(key);
    }, 3600000);

    // ============================================
    // VÉRIFICATION DE L'UTILISATEUR
    // ============================================
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // MÊME RÉPONSE QUE LE COMPTE EXISTE OU NON (sécurité)
    if (!user) {
      return {
        success: true,
        message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
      };
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked) {
      throw new BadRequestException(
        'Votre compte est verrouillé. Contactez le support pour le débloquer.'
      );
    }

    // SUPPRESSION DES ANCIENS TOKENS
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // GÉNÉRATION DU TOKEN (JWT)
    const token = this.jwtService.sign(
      { 
        sub: user.id, 
        type: 'password-reset',
        email: user.email,
      },
      { expiresIn: '15m' }
    );

    // STOCKAGE DU TOKEN HASHÉ
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        ipAddress: ip,
        userAgent: userAgent,
        expiresAt,
      },
    });

    // ENVOI DE L'EMAIL
    try {
      await this.emailService.sendResetPasswordEmail(
        user.email,
        user.username || 'Utilisateur',
        token,
      );
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw new BadRequestException(
        'Erreur lors de l\'envoi de l\'email. Veuillez réessayer.'
      );
    }

    // LOG DE SÉCURITÉ
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        ipAddress: ip,
        userAgent: userAgent,
        details: { email },
      },
    });

    return {
      success: true,
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    };
  }

  // ============================================
  // 2. VÉRIFIER LE TOKEN (AVEC IP CHECK)
  // ============================================
  async verifyResetToken(token: string, ip: string) {
    // Récupérer tous les tokens non expirés
    const resets = await this.prisma.passwordReset.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    let validReset = null;
    for (const reset of resets) {
      const isValid = await bcrypt.compare(token, reset.token);
      if (isValid) {
        validReset = reset;
        break;
      }
    }

    if (!validReset) {
      return { valid: false, message: 'Token invalide.' };
    }

    // VÉRIFICATION IP (optionnel, peut être désactivé)
    if (validReset.ipAddress && validReset.ipAddress !== ip) {
      return { valid: false, message: 'Token invalide (IP différente).' };
    }

    if (validReset.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: validReset.id } });
      return { valid: false, message: 'Token expiré.' };
    }

    return { valid: true, userId: validReset.userId };
  }

  // ============================================
  // 3. RÉINITIALISER LE MOT DE PASSE
  // ============================================
  async resetPassword(token: string, newPassword: string, ip: string) {
    // RÉCUPÉRER LE TOKEN HASHÉ EN BASE
    const resets = await this.prisma.passwordReset.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    let validReset = null;
    for (const reset of resets) {
      const isValid = await bcrypt.compare(token, reset.token);
      if (isValid) {
        validReset = reset;
        break;
      }
    }

    if (!validReset) {
      throw new BadRequestException('Token invalide.');
    }

    if (validReset.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: validReset.id } });
      throw new BadRequestException('Token expiré. Veuillez refaire une demande.');
    }

    // VALIDATION DE LA FORCE DU MOT DE PASSE
    this.validatePasswordStrength(newPassword);

    // VÉRIFICATION QUE LE NOUVEAU MOT DE PASSE EST DIFFÉRENT DE L'ANCIEN
    const isSamePassword = await bcrypt.compare(newPassword, validReset.user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent du précédent.'
      );
    }

    // HACHAGE DU NOUVEAU MOT DE PASSE
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // TRANSACTION
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: validReset.userId },
        data: {
          passwordHash: hashedPassword,
          failedLoginAttempts: 0,
          isLocked: false,
        },
      }),
      this.prisma.passwordReset.delete({
        where: { id: validReset.id },
      }),
      this.prisma.notification.create({
        data: {
          userId: validReset.userId,
          type: 'SYSTEM',
          title: '🔐 Mot de passe réinitialisé',
          body: 'Votre mot de passe a été modifié avec succès. Si vous n\'êtes pas à l\'origine de cette action, contactez immédiatement le support.',
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: validReset.userId,
          action: 'PASSWORD_RESET_SUCCESS',
          ipAddress: ip,
          details: { email: validReset.user.email },
        },
      }),
    ]);

    // ENVOI DE L'EMAIL DE CONFIRMATION
    try {
      await this.emailService.sendEmail({
        to: validReset.user.email,
        subject: '🔐 Mot de passe réinitialisé - INKDROP',
        text: `Bonjour ${validReset.user.username},\n\nVotre mot de passe INKDROP a été réinitialisé avec succès.\n\nSi vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.\n\n© INKDROP`,
        html: `
          <h2>🔐 Mot de passe réinitialisé</h2>
          <p>Bonjour <strong>${validReset.user.username}</strong>,</p>
          <p>Votre mot de passe INKDROP a été réinitialisé avec succès.</p>
          <p style="color:#ff6b6b;"><strong>⚠️ Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.</strong></p>
          <br>
          <p>© INKDROP</p>
        `,
      });
    } catch (error) {
      console.error('❌ Erreur envoi email de confirmation:', error);
    }

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
  async handleFailedLogin(email: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return;

    const attempts = user.failedLoginAttempts + 1;

    if (attempts >= 5) {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            isLocked: true,
          },
        }),
        this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'SYSTEM',
            title: '⚠️ Compte verrouillé',
            body: 'Votre compte a été verrouillé après 5 tentatives de connexion échouées. Utilisez "Mot de passe oublié" pour le déverrouiller.',
          },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ACCOUNT_LOCKED',
            ipAddress: ip,
            details: { attempts },
          },
        }),
      ]);

      try {
        await this.emailService.sendEmail({
          to: user.email,
          subject: '⚠️ Alerte de sécurité - Compte verrouillé',
          text: `Bonjour ${user.username},\n\nVotre compte INKDROP a été verrouillé après 5 tentatives de connexion échouées.\n\nUtilisez "Mot de passe oublié" pour le déverrouiller.\n\n© INKDROP`,
          html: `
            <h2>⚠️ Alerte de sécurité</h2>
            <p>Bonjour <strong>${user.username}</strong>,</p>
            <p>Votre compte INKDROP a été <strong>verrouillé</strong> après 5 tentatives de connexion échouées.</p>
            <p>Utilisez <a href="${process.env.FRONTEND_URL}/forgot-password">"Mot de passe oublié"</a> pour le déverrouiller.</p>
            <br>
            <p>© INKDROP</p>
          `,
        });
      } catch (error) {
        console.error('❌ Erreur envoi email alerte:', error);
      }

      throw new BadRequestException('Compte verrouillé après 5 tentatives. Utilisez "Mot de passe oublié".');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts },
    });
  }

  async handleSuccessfulLogin(userId: string, ip: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          isLocked: false,
          lastLoginAt: new Date(),
          lastLoginIP: ip,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'LOGIN_SUCCESS',
          ipAddress: ip,
        },
      }),
    ]);
  }

  // ============================================
  // 6. NETTOYAGE DES TOKENS EXPIRÉS (CRON)
  // ============================================
  @Cron(CronExpression.EVERY_HOUR)
  async cleanExpiredTokens() {
    const result = await this.prisma.passwordReset.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`🧹 ${result.count} tokens expirés supprimés`);
    }
    return result;
  }
}
