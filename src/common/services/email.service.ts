// src/common/services/email.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // ============================================
  // ENVOI D'EMAIL GÉNÉRIQUE
  // ============================================
  async sendEmail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@inkdrop.com',
      ...options,
    });
  }

  // ============================================
  // EMAIL DE BIENVENUE
  // ============================================
  async sendWelcomeEmail(email: string, username: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563EB;">Bienvenue sur INKDROP !</h1>
        <p>Bonjour <strong>${username}</strong>,</p>
        <p>Nous sommes ravis de vous accueillir sur INKDROP, la plateforme de mangas.</p>
        <p>Commencez à explorer, lire et créer dès maintenant.</p>
        <a href="${process.env.FRONTEND_URL}/discover" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Découvrir</a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">© INKDROP</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Bienvenue sur INKDROP ! 🎉',
      text: `Bonjour ${username},\n\nBienvenue sur INKDROP !\n\nCommencez à explorer, lire et créer dès maintenant.\n\n© INKDROP`,
      html,
    });
  }

  // ============================================
  // EMAIL DE RÉINITIALISATION DE MOT DE PASSE
  // ============================================
  async sendResetPasswordEmail(email: string, username: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="color: #2563EB; margin: 0;">INKDROP</h1>
          <p style="color: #666; font-size: 16px;">Réinitialisation de mot de passe</p>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Bonjour <strong>${username}</strong>,
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Vous avez demandé à réinitialiser votre mot de passe.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #2563EB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Ce lien expire dans 15 minutes.
          </p>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} INKDROP. Tous droits réservés.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: '🔐 Réinitialisation de mot de passe - INKDROP',
      text: `Bonjour ${username},\n\nVous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur le lien suivant pour créer un nouveau mot de passe : ${resetLink}\n\nCe lien expire dans 15 minutes.\n\n© INKDROP`,
      html,
    });
  }

  // ============================================
  // ✅ EMAIL DE VÉRIFICATION POUR CHANGEMENT D'EMAIL
  // ============================================
  async sendEmailVerification(currentEmail: string, token: string, newEmail: string) {
    const verificationLink = `${process.env.FRONTEND_URL}/profile/confirm-email-change?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="color: #2563EB; margin: 0;">INKDROP</h1>
          <p style="color: #666; font-size: 16px;">Confirmation de changement d'email</p>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Bonjour,
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Vous avez demandé à changer votre adresse email de <strong>${currentEmail}</strong> vers <strong>${newEmail}</strong>.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Cliquez sur le lien ci-dessous pour confirmer ce changement :
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #2563EB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Confirmer le changement
            </a>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Ce lien expire dans 24 heures.
          </p>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} INKDROP. Tous droits réservés.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: currentEmail,
      subject: '🔐 Confirmation de changement d\'email - INKDROP',
      text: `Bonjour,\n\nVous avez demandé à changer votre adresse email de ${currentEmail} vers ${newEmail}.\n\nCliquez sur le lien suivant pour confirmer : ${verificationLink}\n\nCe lien expire dans 24 heures.\n\n© INKDROP`,
      html,
    });
  }
}
