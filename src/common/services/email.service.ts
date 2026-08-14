// src/common/services/email.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  // ============================================
  // ENVOYER UN EMAIL GÉNÉRIQUE
  // ============================================
  async sendEmail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    await this.transporter.sendMail({
      from: `"INKDROP" <${this.configService.get('EMAIL_USER')}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    });
  }

  // ============================================
  // ENVOYER UN EMAIL DE RÉINITIALISATION
  // ============================================
  async sendResetPasswordEmail(email: string, username: string, token: string) {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password/${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Réinitialisation INKDROP</title>
      </head>
      <body style="font-family:Arial;background:#0a0a0f;padding:40px;color:#fff;">
        <div style="max-width:600px;margin:0 auto;background:#111118;padding:40px;border-radius:24px;border:1px solid #2a2a4a;">
          <h1 style="text-align:center;font-size:28px;">INK<span style="color:#3b82f6;">DROP</span></h1>
          <div style="text-align:center;font-size:40px;margin:20px 0;">🔐</div>
          <h2 style="text-align:center;color:#fff;">Réinitialisation du mot de passe</h2>
          <p style="color:#a1a1aa;text-align:center;">Bonjour <strong style="color:#fff;">${username}</strong>,</p>
          <p style="color:#a1a1aa;text-align:center;">Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${resetLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;">
              🔑 Réinitialiser
            </a>
          </div>
          <p style="color:#71717a;text-align:center;font-size:13px;">⏳ Ce lien est valable 15 minutes</p>
          <p style="color:#52525b;text-align:center;font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          <hr style="border-color:#1a1a2e;margin:20px 0;">
          <p style="color:#3f3f46;text-align:center;font-size:11px;">© 2026 INKDROP</p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: '🔐 Réinitialisation de votre mot de passe INKDROP',
      text: `Bonjour ${username},\n\nRéinitialisez votre mot de passe : ${resetLink}\n\nCe lien est valable 15 minutes.\n\n© INKDROP`,
      html: htmlContent,
    });
  }

  // ============================================
  // ENVOYER UN EMAIL DE BIENVENUE
  // ============================================
  async sendWelcomeEmail(email: string, username: string) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bienvenue sur INKDROP</title>
      </head>
      <body style="font-family:Arial;background:#0a0a0f;padding:40px;color:#fff;">
        <div style="max-width:600px;margin:0 auto;background:#111118;padding:40px;border-radius:24px;border:1px solid #2a2a4a;">
          <h1 style="text-align:center;font-size:28px;">INK<span style="color:#3b82f6;">DROP</span></h1>
          <div style="text-align:center;font-size:40px;margin:20px 0;">🎉</div>
          <h2 style="text-align:center;color:#fff;">Bienvenue sur INKDROP</h2>
          <p style="color:#a1a1aa;text-align:center;">Bonjour <strong style="color:#fff;">${username}</strong>,</p>
          <p style="color:#a1a1aa;text-align:center;">Nous sommes ravis de vous accueillir sur INKDROP.<br>Commencez à lire, publier et interagir avec une communauté passionnée.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${this.configService.get('FRONTEND_URL')}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;">
              🚀 Découvrir INKDROP
            </a>
          </div>
          <hr style="border-color:#1a1a2e;margin:20px 0;">
          <p style="color:#3f3f46;text-align:center;font-size:11px;">© 2026 INKDROP</p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: '🎉 Bienvenue sur INKDROP',
      text: `Bienvenue sur INKDROP ${username} ! Commencez à lire et publier dès maintenant.`,
      html: htmlContent,
    });
  }
}
