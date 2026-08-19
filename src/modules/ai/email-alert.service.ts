// src/modules/ai/email-alert.service.ts
import { Injectable } from '@nestjs/common';
import { EmailService } from '../../common/services/email.service';
import { EmailAlertData, ModerationSeverity } from './interfaces/ai-tools.interface';

@Injectable()
export class EmailAlertService {
  private readonly SUPPORT_EMAIL = 'inkdrop559@gmail.com';

  constructor(private emailService: EmailService) {}

  // ============================================
  // 1. ENVOYER UNE ALERTE QUAND L'IA EST BLOQUÉE
  // ============================================
  async sendAlert(data: EmailAlertData): Promise<void> {
    const severityColors = {
      low: '#3B82F6', // bleu
      medium: '#F59E0B', // jaune
      high: '#F97316', // orange
      critical: '#EF4444', // rouge
    };

    const severityLabels = {
      low: '🟢 BASSE',
      medium: '🟡 MOYENNE',
      high: '🟠 HAUTE',
      critical: '🔴 CRITIQUE',
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { border-bottom: 3px solid ${severityColors[data.urgency]}; padding-bottom: 15px; margin-bottom: 20px; }
          h1 { color: #111827; margin: 0; font-size: 22px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-left: 10px; }
          .badge-critical { background: #FEE2E2; color: #991B1B; }
          .badge-high { background: #FFEDD5; color: #9A3412; }
          .badge-medium { background: #FEF3C7; color: #92400E; }
          .badge-low { background: #DBEAFE; color: #1E40AF; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4B5563; }
          .value { color: #111827; margin-top: 4px; }
          .code-block { background: #1F2937; color: #E5E7EB; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; overflow-x: auto; margin-top: 8px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; text-align: center; color: #6B7280; font-size: 12px; }
          .button { display: inline-block; padding: 10px 24px; background: #2563EB; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>
              🤖 Xelira - IA INKDROP
              <span class="badge badge-${data.urgency}">${severityLabels[data.urgency]}</span>
            </h1>
          </div>

          <div class="section">
            <div class="label">🕐 Timestamp</div>
            <div class="value">${data.timestamp.toLocaleString('fr-FR')}</div>
          </div>

          <div class="section">
            <div class="label">🔍 Problème</div>
            <div class="value">${data.problem}</div>
          </div>

          <div class="section">
            <div class="label">📋 Détails</div>
            <div class="value">${data.details}</div>
          </div>

          ${data.files && data.files.length > 0 ? `
            <div class="section">
              <div class="label">📁 Fichiers concernés</div>
              <div class="value">${data.files.map(f => `• ${f}`).join('\n')}</div>
            </div>
          ` : ''}

          ${data.suggestedFix ? `
            <div class="section">
              <div class="label">🔧 Solution proposée</div>
              <div class="value">${data.suggestedFix}</div>
            </div>
          ` : ''}

          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL}/admin/dashboard" class="button">📊 Ouvrir le dashboard admin</a>
          </div>

          <div class="footer">
            Cet email a été envoyé automatiquement par Xelira (IA INKDROP).<br>
            ${data.urgency === 'critical' ? '⚠️ Intervention immédiate recommandée.' : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      [Xelira - IA INKDROP] - ${severityLabels[data.urgency]}

      Timestamp : ${data.timestamp.toLocaleString('fr-FR')}

      Problème : ${data.problem}

      Détails : ${data.details}

      ${data.files ? `Fichiers concernés :\n${data.files.map(f => `- ${f}`).join('\n')}` : ''}

      ${data.suggestedFix ? `Solution proposée :\n${data.suggestedFix}` : ''}

      ---
      Cet email a été envoyé automatiquement par Xelira (IA INKDROP).
    `;

    await this.emailService.sendEmail({
      to: this.SUPPORT_EMAIL,
      subject: `🚨 [${severityLabels[data.urgency]}] Xelira - ${data.problem}`,
      text,
      html,
    });
  }

  // ============================================
  // 2. ALERTE : PROBLÈME TECHNIQUE
  // ============================================
  async sendTechnicalAlert(
    problem: string,
    details: string,
    files?: string[],
    suggestedFix?: string
  ): Promise<void> {
    await this.sendAlert({
      to: this.SUPPORT_EMAIL,
      subject: `🚨 Problème technique - ${problem}`,
      problem,
      details,
      files,
      suggestedFix,
      urgency: 'high',
      timestamp: new Date(),
    });
  }

  // ============================================
  // 3. ALERTE : MODÉRATION (BANNISSEMENT, ETC.)
  // ============================================
  async sendModerationAlert(
    action: 'ban' | 'warn' | 'delete',
    userId: string,
    reason: string
  ): Promise<void> {
    const actionLabels = {
      ban: '🚫 Bannissement',
      warn: '⚠️ Avertissement',
      delete: '🗑️ Suppression',
    };

    await this.sendAlert({
      to: this.SUPPORT_EMAIL,
      subject: `🛡️ Action de modération - ${actionLabels[action]}`,
      problem: `${actionLabels[action]} effectué par Xelira`,
      details: `
        Action : ${actionLabels[action]}
        Utilisateur : ${userId}
        Raison : ${reason}
        Agent : Xelira (IA)
      `,
      urgency: 'medium',
      timestamp: new Date(),
    });
  }

  // ============================================
  // 4. ALERTE : ACCÈS REFUSÉ
  // ============================================
  async sendAccessDeniedAlert(
    attemptedAction: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.sendAlert({
      to: this.SUPPORT_EMAIL,
      subject: `🔒 Accès refusé - ${attemptedAction}`,
      problem: `Xelira n'a pas pu effectuer : ${attemptedAction}`,
      details: `
        Action tentée : ${attemptedAction}
        Utilisateur : ${userId}
        Raison : ${reason}
        Besoin : Droits ADMIN supplémentaires
      `,
      urgency: 'high',
      timestamp: new Date(),
    });
  }
}