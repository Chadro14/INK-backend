// src/modules/ai/moderation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolsService } from './tools.service';
import { CommentToModerate, ModerationResult, ModerationAction, ModerationSeverity } from './interfaces/ai-tools.interface';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private toolsService: ToolsService,
  ) {}

  // ============================================
  // 1. ANALYSER UN COMMENTAIRE AVEC L'IA
  // ============================================
  async analyzeComment(commentId: string): Promise<ModerationResult> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: true,
      },
    });

    if (!comment) {
      throw new BadRequestException('Commentaire non trouvé');
    }

    // Récupérer l'historique de l'utilisateur
    const userWarnings = comment.user.warningsCount || 0;
    const userComments = await this.prisma.comment.count({
      where: { userId: comment.userId },
    });

    const context: CommentToModerate = {
      id: comment.id,
      content: comment.content,
      userId: comment.userId,
      mangaId: comment.mangaId,
      chapterId: comment.chapterId || undefined,
      createdAt: comment.createdAt,
      username: comment.user.username,
      userRole: comment.user.role,
      userIsCertified: comment.user.isCertified,
      userPreviousWarnings: userWarnings,
      userPreviousBans: 0, // À implémenter si besoin
    };

    // 1. Vérification simple (mots interdits)
    const fastCheck = this.fastCheck(comment.content);
    if (fastCheck) {
      return fastCheck;
    }

    // 2. Analyse approfondie avec Groq
    const result = await this.deepAnalysis(context);

    // 3. Appliquer l'action
    await this.applyAction(commentId, comment.userId, result);

    return result;
  }

  // ============================================
  // 2. VÉRIFICATION RAPIDE (MOTS INTERDITS)
  // ============================================
  private fastCheck(content: string): ModerationResult | null {
    const forbiddenWords = [
      // Insultes
      'conard', 'connard', 'pute', 'salope', 'enculé', 'batard', 'bâtard',
      'fdp', 'pd', 'ntm', 'tg', 'va te faire', 'trou du cul',
      // Harcèlement
      'suicide', 'tue toi', 'kill yourself',
      // Spam
      'cliquez ici', 'gagnez de l\'argent', 'regardez mon profil',
    ];

    const lowerContent = content.toLowerCase();

    for (const word of forbiddenWords) {
      if (lowerContent.includes(word)) {
        return {
          action: ModerationAction.DELETE,
          severity: ModerationSeverity.HIGH,
          reason: `Contenu inapproprié détecté : "${word}"`,
          confidence: 0.95,
          requiresHumanReview: false,
        };
      }
    }

    return null;
  }

  // ============================================
  // 3. ANALYSE APPROFONDIE AVEC GROQ
  // ============================================
  private async deepAnalysis(context: CommentToModerate): Promise<ModerationResult> {
    const prompt = `
Analyse ce commentaire pour détecter des comportements inappropriés.

📝 COMMENTAIRE :
"${context.content}"

👤 UTILISATEUR :
- Nom : ${context.username}
- Rôle : ${context.userRole}
- Certifié : ${context.userIsCertified ? 'Oui' : 'Non'}
- Avertissements précédents : ${context.userPreviousWarnings}

⚠️ DÉTECTER :
1. SPAM : Contenu promotionnel, liens suspects
2. INSULTES : Langage grossier, attaques personnelles
3. HARCÈLEMENT : Ciblage d'un utilisateur
4. CONTENU INAPPROPRIÉ : Violence, propos discriminatoires

📋 RÉPONDRE EN JSON UNIQUEMENT :
{
  "action": "approve | warn | delete | ban",
  "severity": "low | medium | high | critical",
  "reason": "Courte explication",
  "confidence": 0.0-1.0,
  "requiresHumanReview": true/false,
  "suggestedWarningMessage": "Message d'avertissement (si warn)"
}`;

    try {
      const response = await this.callGroq(prompt);
      const result = JSON.parse(response);

      return {
        action: result.action as ModerationAction,
        severity: result.severity as ModerationSeverity,
        reason: result.reason,
        confidence: result.confidence,
        requiresHumanReview: result.requiresHumanReview || false,
      };
    } catch (error) {
      // En cas d'erreur, on approuve par défaut
      return {
        action: ModerationAction.APPROVE,
        severity: ModerationSeverity.LOW,
        reason: 'Analyse automatique indisponible, approbation par défaut',
        confidence: 0.5,
        requiresHumanReview: true,
      };
    }
  }

  // ============================================
  // 4. APPLIQUER L'ACTION
  // ============================================
  private async applyAction(commentId: string, userId: string, result: ModerationResult) {
    switch (result.action) {
      case ModerationAction.APPROVE:
        await this.approveComment(commentId);
        break;

      case ModerationAction.WARN:
        await this.toolsService.warnUser({
          userId,
          message: result.reason || 'Comportement inapproprié',
        });
        await this.approveComment(commentId);
        break;

      case ModerationAction.DELETE:
        await this.toolsService.deleteComment({
          commentId,
          reason: result.reason,
        });
        break;

      case ModerationAction.BAN:
        await this.toolsService.banUser({
          userId,
          reason: result.reason || 'Comportement grave',
          permanent: result.severity === 'critical',
          duration: result.severity === 'critical' ? 'permanent' : '30d',
        });
        await this.toolsService.deleteComment({
          commentId,
          reason: result.reason,
        });
        break;

      case ModerationAction.REPORT:
        await this.reportComment(commentId, result.reason);
        break;
    }
  }

  // ============================================
  // 5. APPROUVER UN COMMENTAIRE
  // ============================================
  private async approveComment(commentId: string) {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: 'ACTIVE' },
    });
  }

  // ============================================
  // 6. SIGNALER UN COMMENTAIRE
  // ============================================
  private async reportComment(commentId: string, reason: string) {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { isReported: true },
    });

    // Notification aux admins (via l'IA)
    await this.prisma.auditLog.create({
      data: {
        action: 'COMMENT_REPORTED_BY_AI',
        targetId: commentId,
        details: { reason },
      },
    });
  }

  // ============================================
  // 7. APPEL GROQ
  // ============================================
  private async callGroq(prompt: string): Promise<string> {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const apiKey = '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';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Tu es un modérateur IA. Tu analyses des commentaires et réponds UNIQUEMENT en JSON valide.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '{"action":"approve","severity":"low","reason":"Erreur d\'analyse","confidence":0.5,"requiresHumanReview":true}';
  }
}