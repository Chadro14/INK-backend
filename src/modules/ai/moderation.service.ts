// src/modules/ai/moderation.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolsService } from './tools.service';
import { AiRouterService } from './ai-router.service';
import {
  CommentToModerate,
  ModerationResult,
  ModerationAction,
  ModerationSeverity,
} from './interfaces/ai-tools.interface';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private prisma: PrismaService,
    private toolsService: ToolsService,
    private aiRouter: AiRouterService,
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
      userPreviousBans: 0,
    };

    // 1. Vérification rapide (mots interdits) — pas d'IA, très rapide
    const fastCheck = this.fastCheck(comment.content);
    if (fastCheck) {
      await this.applyAction(commentId, comment.userId, fastCheck);
      return fastCheck;
    }

    // 2. Analyse approfondie avec l'IA (via le routeur)
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
      'conard',
      'connard',
      'pute',
      'salope',
      'enculé',
      'batard',
      'bâtard',
      'fdp',
      'pd',
      'ntm',
      'tg',
      'va te faire',
      'trou du cul',
      'suicide',
      'tue toi',
      'kill yourself',
      'cliquez ici',
      "gagnez de l'argent",
      'regardez mon profil',
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
  // 3. ANALYSE APPROFONDIE AVEC L'IA
  // ============================================
  private async deepAnalysis(
    context: CommentToModerate,
  ): Promise<ModerationResult> {
    const systemInstruction = `Tu es un modérateur IA pour INKDROP. Tu analyses des commentaires et réponds UNIQUEMENT en JSON valide, sans texte autour.`;

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

📋 RÉPONDS EN JSON UNIQUEMENT :
{
  "action": "approve | warn | delete | ban",
  "severity": "low | medium | high | critical",
  "reason": "Courte explication",
  "confidence": 0.0-1.0,
  "requiresHumanReview": true/false
}`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
      });

      // Nettoyer la réponse (au cas où il y a du texte autour du JSON)
      const cleanedResponse = this.extractJson(result.content);
      const parsed = JSON.parse(cleanedResponse);

      return {
        action: parsed.action as ModerationAction,
        severity: parsed.severity as ModerationSeverity,
        reason: parsed.reason,
        confidence: parsed.confidence,
        requiresHumanReview: parsed.requiresHumanReview || false,
      };
    } catch (error) {
      this.logger.warn(
        `Analyse IA échouée, approbation par défaut : ${error.message}`,
      );

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
  // HELPER : EXTRAIRE LE JSON DE LA RÉPONSE
  // ============================================
  private extractJson(text: string): string {
    // Cherche le premier { et le dernier }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error('Pas de JSON valide dans la réponse');
    }

    return text.substring(firstBrace, lastBrace + 1);
  }

  // ============================================
  // 4. APPLIQUER L'ACTION
  // ============================================
  private async applyAction(
    commentId: string,
    userId: string,
    result: ModerationResult,
  ) {
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

      default:
        this.logger.warn(`Action inconnue : ${result.action}`);
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

    await this.prisma.auditLog.create({
      data: {
        action: 'COMMENT_REPORTED_BY_AI',
        targetId: commentId,
        details: { reason },
      },
    });
  }
}
