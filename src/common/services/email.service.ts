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

  async sendResetPasswordEmail(email: string, username: string, token: string) {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password/${token}`;

    await this.sendEmail({
      to: email,
      subject: '🔐 Réinitialisation de votre mot de passe INKDROP',
      text: `Bonjour ${username},\n\nRéinitialisez votre mot de passe : ${resetLink}\n\nCe lien est valable 15 minutes.\n\n© INKDROP`,
      html: `
        <h1>Réinitialisation du mot de passe</h1>
        <p>Bonjour ${username},</p>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Ce lien est valable 15 minutes.</p>
        <p>© INKDROP</p>
      `,
    });
  }

  async sendWelcomeEmail(email: string, username: string) {
    await this.sendEmail({
      to: email,
      subject: '🎉 Bienvenue sur INKDROP',
      text: `Bienvenue sur INKDROP ${username} ! Commencez à lire et publier dès maintenant.`,
      html: `
        <h1>Bienvenue sur INKDROP</h1>
        <p>Bonjour ${username},</p>
        <p>Nous sommes ravis de vous accueillir sur INKDROP.</p>
        <p>Commencez à lire et publier dès maintenant.</p>
        <p>© INKDROP</p>
      `,
    });
  }
}
