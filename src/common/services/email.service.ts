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
      secure: false, // true pour 465, false pour 587
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  // ============================================
  // ENVOYER UN EMAIL DE RÉINITIALISATION
  // ============================================
  async sendResetPasswordEmail(email: string, username: string, token: string) {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password/${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation INKDROP</title>
      </head>
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#0a0a0f;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color:#0a0a0f;padding:40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;background:linear-gradient(145deg,#111118,#1a1a2e);border-radius:24px;padding:40px 30px;border:1px solid #2a2a4a;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
                <tr>
                  <td align="center" style="padding-bottom:30px;">
                    <span style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:2px;">
                      INK<span style="color:#3b82f6;">DROP</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <div style="width:70px;height:70px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto;">
                      🔐
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:700;text-align:center;padding-bottom:12px;">
                    Réinitialisation du mot de passe
                  </td>
                </tr>
                <tr>
                  <td style="color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;padding-bottom:8px;">
                    Bonjour <strong style="color:#ffffff;">${username}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;padding-bottom:24px;">
                    Vous avez demandé à réinitialiser votre mot de passe INKDROP.<br>
                    Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:30px;">
                    <a href="${resetLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:50px;box-shadow:0 8px 30px rgba(59,130,246,0.4);transition:all 0.3s ease;">
                      🔑 Réinitialiser
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#71717a;font-size:13px;text-align:center;padding-bottom:20px;border-top:1px solid #2a2a4a;padding-top:20px;">
                    ⏳ Ce lien est valable <strong style="color:#a1a1aa;">15 minutes</strong>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b;font-size:12px;text-align:center;line-height:1.5;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.<br>
                    Votre compte reste sécurisé.
                  </td>
                </tr>
                <tr>
                  <td style="color:#3f3f46;font-size:11px;text-align:center;padding-top:24px;border-top:1px solid #1a1a2e;">
                    © 2026 INKDROP — Votre plateforme de mangas
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textContent = `
      INKDROP - Réinitialisation du mot de passe

      Bonjour ${username},

      Vous avez demandé à réinitialiser votre mot de passe INKDROP.
      Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :

      ${resetLink}

      ⏳ Ce lien est valable 15 minutes.

      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
      Votre compte reste sécurisé.

      © 2026 INKDROP
    `;

    await this.transporter.sendMail({
      from: `"INKDROP" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🔐 Réinitialisation de votre mot de passe INKDROP',
      text: textContent,
      html: htmlContent,
    });
  }

  // ============================================
  // ENVOYER UN EMAIL DE BIENVENUE
  // ============================================
  async sendWelcomeEmail(email: string, username: string) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur INKDROP</title>
      </head>
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#0a0a0f;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color:#0a0a0f;padding:40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;background:linear-gradient(145deg,#111118,#1a1a2e);border-radius:24px;padding:40px 30px;border:1px solid #2a2a4a;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
                <tr>
                  <td align="center" style="padding-bottom:30px;">
                    <span style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:2px;">
                      INK<span style="color:#3b82f6;">DROP</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <div style="width:70px;height:70px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto;">
                      🎉
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#ffffff;font-size:24px;font-weight:700;text-align:center;padding-bottom:12px;">
                    Bienvenue sur INKDROP
                  </td>
                </tr>
                <tr>
                  <td style="color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;padding-bottom:8px;">
                    Bonjour <strong style="color:#ffffff;">${username}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="color:#a1a1aa;font-size:15px;line-height:1.6;text-align:center;padding-bottom:24px;">
                    Nous sommes ravis de vous accueillir sur INKDROP, la plateforme de mangas.<br>
                    Commencez à lire, publier et interagir avec une communauté passionnée.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:30px;">
                    <a href="${this.configService.get('FRONTEND_URL')}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:50px;box-shadow:0 8px 30px rgba(59,130,246,0.4);">
                      🚀 Découvrir INKDROP
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b;font-size:12px;text-align:center;line-height:1.5;">
                    Besoin d'aide ? XELIRA est là pour vous guider.
                  </td>
                </tr>
                <tr>
                  <td style="color:#3f3f46;font-size:11px;text-align:center;padding-top:24px;border-top:1px solid #1a1a2e;">
                    © 2026 INKDROP — Votre plateforme de mangas
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: `"INKDROP" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: '🎉 Bienvenue sur INKDROP',
      text: `Bienvenue sur INKDROP ${username} ! Commencez à lire et publier dès maintenant.`,
      html: htmlContent,
    });
  }
}
