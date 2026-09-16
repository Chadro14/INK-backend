// src/modules/ai/ai.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from './moderation.service';
import { ToolsService } from './tools.service';
import { FileReaderService } from './file-reader.service';
import { EmailAlertService } from './email-alert.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { SearchService } from './search.service';
import { AssistantService } from './assistant.service';
import { CoachService } from './coach.service';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private toolsService: ToolsService,
    private fileReaderService: FileReaderService,
    private emailAlertService: EmailAlertService,
    private summaryService: SummaryService,
    private tagService: TagService,
    private searchService: SearchService,
    private assistantService: AssistantService,
    private coachService: CoachService,
    private aiRouter: AiRouterService,
  ) {}

  // ============================================
  // CHAT PRINCIPAL
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
  ) {
    if (!message) {
      throw new BadRequestException('Message requis');
    }

    let userName = firstName;
    if (!userName || userName === '' || userName === 'Utilisateur') {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        userName = user?.username || 'Utilisateur';
      } catch {
        userName = 'Utilisateur';
      }
    }
    userName = userName.replace(/^@/, '');

    const lowerMessage = message.toLowerCase();
    let intent = 'chat';
    let extractedData: any = {};

    // === NOUVELLES INTENTIONS ===
    if (
      lowerMessage.includes('modérer') ||
      lowerMessage.includes('analyser ce commentaire') ||
      lowerMessage.includes('inspecter ce commentaire') ||
      lowerMessage.includes('vérifier ce commentaire')
    ) {
      intent = 'moderate';
      const commentMatch = message.match(/commentaire\s*[:\s]*([a-f0-9-]+)/i);
      extractedData.commentId = commentMatch ? commentMatch[1] : null;
    } else if (
      lowerMessage.includes('bannir') ||
      lowerMessage.includes('ban') ||
      lowerMessage.includes('supprimer ce compte')
    ) {
      intent = 'ban';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.reason = message
        .replace(/bannir|ban|supprimer ce compte/gi, '')
        .trim();
    } else if (
      lowerMessage.includes('supprimer ce commentaire') ||
      lowerMessage.includes('effacer ce commentaire')
    ) {
      intent = 'deleteComment';
      const commentMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.commentId = commentMatch ? commentMatch[0] : null;
    } else if (
      lowerMessage.includes('avertir') ||
      lowerMessage.includes('warn')
    ) {
      intent = 'warn';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.message = message.replace(/avertir|warn/gi, '').trim();
    } else if (
      lowerMessage.includes('analyser ce fichier') ||
      lowerMessage.includes('regarde ce fichier') ||
      lowerMessage.includes('inspecter ce fichier')
    ) {
      intent = 'analyzeFile';
      const fileMatch = message.match(/fichier\s*[:\s]*([^\s]+)/i);
      extractedData.filePath = fileMatch ? fileMatch[1] : null;
      extractedData.error = message.includes('erreur') ? message : null;
    } else if (
      lowerMessage.includes('structure du projet') ||
      lowerMessage.includes('architecture du projet')
    ) {
      intent = 'projectStructure';
    } else if (
      lowerMessage.includes("je n'arrive pas") ||
      lowerMessage.includes('ça ne marche pas') ||
      lowerMessage.includes('problème') ||
      lowerMessage.includes('erreur') ||
      lowerMessage.includes('bug')
    ) {
      intent = 'help';
      extractedData.context = message;
    }

    // === ANCIENNES INTENTIONS ===
    else if (
      lowerMessage.includes('résumé') ||
      lowerMessage.includes('synopsis') ||
      lowerMessage.includes('résume')
    ) {
      intent = 'summarize';
      extractedData.topic =
        message.replace(/résumé|synopsis|résume/gi, '').trim() || 'ton manga';
    } else if (
      lowerMessage.includes('tag') ||
      lowerMessage.includes('étiquette') ||
      lowerMessage.includes('catégorie')
    ) {
      intent = 'tags';
      extractedData.context = message;
    } else if (
      lowerMessage.includes('idée') ||
      lowerMessage.includes('dialogue') ||
      lowerMessage.includes('écrire') ||
      lowerMessage.includes('améliorer')
    ) {
      intent = 'assistant';
      extractedData.context = message;
    } else if (
      lowerMessage.includes('analyse') ||
      lowerMessage.includes('conseil') ||
      lowerMessage.includes('croissance') ||
      lowerMessage.includes('stratégie')
    ) {
      intent = 'coach';
      extractedData.context = message;
    } else if (
      lowerMessage.includes('cherche') ||
      lowerMessage.includes('trouve') ||
      lowerMessage.includes('recherche')
    ) {
      intent = 'search';
      extractedData.query =
        message.replace(/cherche|trouve|recherche/gi, '').trim() || message;
    }

    let reply: string;

    try {
      switch (intent) {
        case 'moderate':
          reply = await this.handleModerate(userName, extractedData);
          break;
        case 'ban':
          reply = await this.handleBan(userName, extractedData);
          break;
        case 'deleteComment':
          reply = await this.handleDeleteComment(userName, extractedData);
          break;
        case 'warn':
          reply = await this.handleWarn(userName, extractedData);
          break;
        case 'analyzeFile':
          reply = await this.handleAnalyzeFile(userName, extractedData);
          break;
        case 'projectStructure':
          reply = await this.handleProjectStructure(userName);
          break;
        case 'help':
          reply = await this.handleHelp(userName, extractedData.context);
          break;
        case 'summarize':
          reply = await this.handleSummarize(userName, extractedData.topic);
          break;
        case 'tags':
          reply = await this.handleTags(userName, extractedData.context);
          break;
        case 'assistant':
          reply = await this.handleAssistant(userName, extractedData.context);
          break;
        case 'coach':
          reply = await this.handleCoach(userName, extractedData.context);
          break;
        case 'search':
          reply = await this.handleSearch(userName, extractedData.query);
          break;
        default:
          reply = await this.handleChat(userName, message, history);
      }
    } catch (error) {
      this.logger.error(
        `Erreur dans l'intention "${intent}" : ${error.message}`,
        error.stack,
      );

      await this.emailAlertService
        .sendTechnicalAlert(
          `Erreur dans l'intention "${intent}"`,
          `Utilisateur : ${userName}\nMessage : ${message}\nErreur : ${error.message}`,
          [],
          'Vérifiez les logs du backend pour plus de détails.',
        )
        .catch(() => {
          /* silencieux si l'email échoue */
        });

      reply = `Désolée ${userName} 🙈, je n'ai pas pu traiter ta demande. Un email a été envoyé à l'équipe technique. Réessaie dans quelques minutes. 😊\n\n— OZYRA ✦`;
    }

    return { success: true, reply: this.cleanReply(reply) };
  }

  // ============================================
  // CHAT GÉNÉRAL (PROMPT PRINCIPAL)
  // ============================================
  private async handleChat(
    userName: string,
    message: string,
    history: any[],
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(userName);

    const messages = [
      ...history.slice(-10).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const result = await this.aiRouter.call({
      messages,
      systemInstruction: systemPrompt,
      temperature: 0.7,
      maxTokens: 800,
    });

    return result.content;
  }

  // ============================================
  // PROMPT SYSTÈME OZYRA
  // ============================================
  private buildSystemPrompt(userName: string): string {
    return `Tu es OZYRA 🤖, l'assistante officielle d'INKDROP.
Xelira Studio est l'entreprise basée à Kinshasa, RDC, qui a créé INKDROP.

📌 RÈGLES FONDAMENTALES :
1. Tu réponds UNIQUEMENT en français.
2. Tu ne parles que d'INKDROP.
3. Si la question est hors sujet → "Désolée, je suis uniquement dédiée à INKDROP."
4. Tu utilises toujours le prénom de l'utilisateur : ${userName}.
5. Tu termines toujours par une question ou une suggestion d'action.
6. Tu ne donnes JAMAIS de fausses informations. Si tu ne sais pas → "Je vais transmettre à l'équipe INKDROP."

🎯 TON RÔLE :
- Tu es chaleureuse, précise, jamais robotique.
- Tu adaptes ton ton : amical pour les lecteurs, technique pour les créateurs, concis pour les admins.
- Tu n'inventes JAMAIS de données (chiffres, titres, noms).

📚 CE QUE TU SAIS SUR INKDROP :

MONNAIE : MANAS (1 MANAS ≈ 0.01 USD)
- Chapitre payant : 50 MANAS (prix fixe, choisi par la plateforme)
- Ticket : accès 2h à un chapitre payant
- Premium : payable par mobile money (Orange Money, M-Pesa, Airtel)

PREMIUM :
- Standard (3 USD / 1 mois) : tickets illimités + accès chapitres payants + badge bleu
- Pro (5 USD / 2 mois) : tout Standard + collab chat gratuite + badge violet + 4 mangas épinglés
- Premium (7 USD / 3 mois) : tout Pro + badge or + 5 mangas épinglés + création d'événements + badge Meilleur Fan

PUBLICATION :
- Tout utilisateur peut publier un manga
- Le créateur choisit : gratuit ou payant (50 MANAS)
- Le créateur touche 100% des ventes de ses chapitres

RÔLE DE XELIRA STUDIO :
- Entreprise de développement informatique basée à Kinshasa, RDC
- Mission : innover et construire un avenir meilleur pour les développeurs africains

Termine toujours par une question. 😊`;
  }

  // ============================================
  // HANDLER : MODÉRATION
  // ============================================
  private async handleModerate(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour modérer un commentaire, j'ai besoin de son ID. Peux-tu me le donner stp ? 😊\n\n— OZYRA ✦`;
    }

    const result = await this.moderationService.analyzeComment(data.commentId);

    const actionEmojis: Record<string, string> = {
      approve: '✅',
      warn: '⚠️',
      delete: '🗑️',
      ban: '🚫',
      report: '📢',
    };

    const actionLabels: Record<string, string> = {
      approve: 'Approuvé ✅',
      warn: 'Avertissement envoyé ⚠️',
      delete: 'Commentaire supprimé 🗑️',
      ban: 'Utilisateur banni 🚫',
      report: 'Signalé aux admins 📢',
    };

    const severityLabels: Record<string, string> = {
      low: '🟢 Basse',
      medium: '🟡 Moyenne',
      high: '🟠 Haute',
      critical: '🔴 Critique',
    };

    return `${userName} 👋, ${actionEmojis[result.action] || '✅'} **${actionLabels[result.action] || 'Traité'}**\n\n📋 Raison : ${result.reason}\n⚠️ Sévérité : ${severityLabels[result.severity] || 'Basse'}\n🎯 Confiance : ${Math.round(result.confidence * 100)}%\n${result.requiresHumanReview ? '\n👨‍💼 Une révision humaine est recommandée.' : ''}\n\nEst-ce que tout est clair pour toi ? 😊\n\n— OZYRA ✦`;
  }

  // ============================================
  // HANDLER : BANNIR
  // ============================================
  private async handleBan(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🙈, pour bannir un utilisateur, j'ai besoin de son ID. Peux-tu me le donner ?\n\n— OZYRA ✦`;
    }

    const result = await this.toolsService.banUser({
      userId: data.userId,
      reason: data.reason || 'Comportement inapproprié (décision Ozyra)',
      permanent: false,
      duration: '30d',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu bannir cet utilisateur. ${result.message}\n\nTu veux que je t'aide à autre chose ? 😊\n\n— OZYRA ✦`;
    }

    return `${userName} ✅, **l'utilisateur a été banni avec succès** ! 🚫\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Raison : ${result.data.reason}\n• Date : ${new Date(result.data.bannedAt).toLocaleString('fr-FR')}\n\nTu as d'autres questions ? 😊\n\n— OZYRA ✦`;
  }

  // ============================================
  // HANDLER : SUPPRIMER UN COMMENTAIRE
  // ============================================
  private async handleDeleteComment(
    userName: string,
    data: any,
  ): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour supprimer un commentaire, j'ai besoin de son ID. Tu peux me le donner ?\n\n— OZYRA ✦`;
    }

    const result = await this.toolsService.deleteComment({
      commentId: data.commentId,
      reason: 'Supprimé par Ozyra (IA)',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu supprimer ce commentaire. ${result.message}\n\nTu veux que je t'aide sur autre chose ? 😊\n\n— OZYRA ✦`;
    }

    return `${userName} 🗑️, le **commentaire a été supprimé avec succès** !\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Commentaire ID : ${result.data.commentId}\n\nBesoin d'autre chose ? 😊\n\n— OZYRA ✦`;
  }

  // ============================================
  // HANDLER : AVERTIR
  // ============================================
  private async handleWarn(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🤔, pour avertir un utilisateur, j'ai besoin de son ID. Tu peux me le donner ?\n\n— OZYRA ✦`;
    }

    const result = await this.toolsService.warnUser({
      userId: data.userId,
      message: data.message || 'Avertissement de Ozyra (IA)',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu avertir cet utilisateur. ${result.message}\n\nTu veux que je t'aide autrement ? 😊\n\n— OZYRA ✦`;
    }

    let message = `${userName} ⚠️, **l'avertissement a été envoyé** !\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Avertissement #${result.data.warnings}\n`;

    if (result.data.autoBanned) {
      message += `\n🚫 **L'utilisateur a été banni automatiquement** (3 avertissements).`;
    }

    message += `\n\nTu as d'autres questions ? 😊\n\n— OZYRA ✦`;
    return message;
  }

  // ============================================
  // HANDLER : ANALYSER UN FICHIER
  // ============================================
  private async handleAnalyzeFile(
    userName: string,
    data: any,
  ): Promise<string> {
    if (!data.filePath) {
      return `${userName} 🤔, pour analyser un fichier, j'ai besoin de son chemin (ex: src/modules/ai/ai.service.ts). Tu peux me le donner ?\n\n— OZYRA ✦`;
    }

    try {
      const analysis = await this.fileReaderService.analyzeCode(
        data.filePath,
        data.error || undefined,
      );

      let reply = `${userName} 📁, **voici l'analyse du fichier** :\n\n`;
      reply += analysis.summary + '\n\n';

      if (analysis.issues.length > 0) {
        reply += '🔍 **Problèmes détectés :**\n';
        for (const issue of analysis.issues) {
          const emoji =
            issue.type === 'error'
              ? '❌'
              : issue.type === 'warning'
                ? '⚠️'
                : 'ℹ️';
          reply += `  ${emoji} Ligne ${issue.line} : ${issue.message}\n`;
          if (issue.suggestion) {
            reply += `     → Suggestion : ${issue.suggestion}\n`;
          }
        }
      } else {
        reply += '✅ Aucun problème détecté dans ce fichier !\n';
      }

      reply += `\nEst-ce que ça t'aide ? 😊\n\n— OZYRA ✦`;
      return reply;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser ce fichier. Erreur : ${error.message}\n\nTu veux que j'essaie autre chose ? 😊\n\n— OZYRA ✦`;
    }
  }

  // ============================================
  // HANDLER : STRUCTURE DU PROJET
  // ============================================
  private async handleProjectStructure(userName: string): Promise<string> {
    try {
      const structure = await this.fileReaderService.analyzeProjectStructure();

      let reply = `${userName} 📁, **voici la structure du projet** :\n\n`;
      reply += `📊 Total : ${structure.totalFiles} fichiers\n\n`;

      const formatStructure = (
        obj: Record<string, any>,
        indent: string = '',
      ): string => {
        let result = '';
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'files') continue;
          if (typeof value === 'object' && !Array.isArray(value)) {
            result += `${indent}📂 ${key}/\n`;
            result += formatStructure(value, indent + '  ');
          }
        }
        return result;
      };

      reply += formatStructure(structure.structure);
      reply += `\n📝 ${structure.files.length} fichiers affichés (sur ${structure.totalFiles})`;

      reply += `\n\nEst-ce que ça répond à ta question ? 😊\n\n— OZYRA ✦`;
      return reply;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser la structure du projet. Erreur : ${error.message}\n\nTu veux que je fasse autre chose ? 😊\n\n— OZYRA ✦`;
    }
  }

  // ============================================
  // HANDLER : AIDE
  // ============================================
  private async handleHelp(
    userName: string,
    context: string,
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'INKDROP. Tu aides les utilisateurs à résoudre leurs problèmes techniques ou d'utilisation. Sois précise, utile, et termine par une question.`;

    const prompt = `L'utilisateur ${userName} a un problème : "${context || 'problème technique'}".

Donne des conseils pour résoudre ce problème. Sois précis et utile.`;

    const result = await this.aiRouter.ask(prompt, systemInstruction);
    return result.content;
  }

  // ============================================
  // HANDLER : RÉSUMÉ
  // ============================================
  private async handleSummarize(
    userName: string,
    topic: string,
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'INKDROP. Tu génères des résumés courts et accrocheurs de mangas.`;

    const prompt = `L'utilisateur ${userName} a demandé un résumé pour : "${topic}".

Génère un résumé court (3-4 phrases), accrocheur, sans révéler la fin. Utilise le prénom ${userName}.`;

    const result = await this.aiRouter.ask(prompt, systemInstruction);
    return result.content;
  }

  // ============================================
  // HANDLER : TAGS
  // ============================================
  private async handleTags(
    userName: string,
    context: string,
  ): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé des tags pour : "${context}".

Propose 5 tags courts (1-2 mots), séparés par des virgules. Utilise le prénom ${userName} dans ta réponse.

Tags :`;

    const result = await this.aiRouter.ask(prompt);
    const reply = result.content;

    const tags = reply
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 5);

    return `🏷️ ${userName}, voici 5 tags pertinents :\n\n${tags.map((t: string) => `• ${t}`).join('\n')}\n\nCes tags correspondent-ils à ce que tu cherchais ? 😊\n\n— OZYRA ✦`;
  }

  // ============================================
  // HANDLER : ASSISTANT
  // ============================================
  private async handleAssistant(
    userName: string,
    context: string,
  ): Promise<string> {
    try {
      const result = await this.assistantService.suggestIdeas(
        context,
        [],
        'Non spécifié',
      );
      return `${result}\n\nEst-ce que ces idées t'inspirent ? 😊\n\n— OZYRA ✦`;
    } catch (error) {
      const systemInstruction = `Tu es OZYRA, l'assistante d'INKDROP. Tu aides les créateurs de mangas avec des idées créatives.`;
      const prompt = `L'utilisateur ${userName} a demandé : "${context}". Donne 3 suggestions concrètes (idées, dialogues, améliorations) courtes. Utilise le prénom ${userName}. Termine par une question.`;

      const result = await this.aiRouter.ask(prompt, systemInstruction);
      return result.content;
    }
  }

  // ============================================
  // HANDLER : COACH
  // ============================================
  private async handleCoach(
    userName: string,
    context: string,
  ): Promise<string> {
    try {
      const result = await this.coachService.suggestImprovements(
        'Manga sans titre',
        context || 'Aucune description',
        [],
      );
      return `${result}\n\nEst-ce que ces conseils t'aident ? 😊\n\n— OZYRA ✦`;
    } catch (error) {
      const systemInstruction = `Tu es OZYRA, l'assistante d'INKDROP. Tu joues le rôle de coach pour les créateurs de mangas.`;
      const prompt = `L'utilisateur ${userName} a demandé : "${context}". Donne 3 conseils concrets pour améliorer son travail. Utilise le prénom ${userName}. Termine par une question.`;

      const result = await this.aiRouter.ask(prompt, systemInstruction);
      return result.content;
    }
  }

  // ============================================
  // HANDLER : RECHERCHE
  // ============================================
  private async handleSearch(
    userName: string,
    query: string,
  ): Promise<string> {
    try {
      const results = await this.searchService.intelligentSearch(query, 5);
      if (results.length === 0) {
        return `${userName} 🔍, je n'ai trouvé aucun manga correspondant à "${query}". Essaie d'autres mots-clés ! 😊\n\n— OZYRA ✦`;
      }
      let reply = `${userName} 🔍, voici les résultats pour "${query}" :\n\n`;
      for (const manga of results.slice(0, 5)) {
        reply += `📖 **${manga.title}**\n`;
        reply += `   👤 ${manga.author?.username || 'Inconnu'}\n`;
        reply += `   ❤️ ${manga._count?.likes || 0} likes\n`;
        reply += `   📚 ${manga._count?.chapters || 0} chapitres\n\n`;
      }
      reply += `Tu veux plus de détails sur l'un d'eux ? 😊\n\n— OZYRA ✦`;
      return reply;
    } catch (error) {
      const prompt = `L'utilisateur ${userName} cherche : "${query}". Propose 3 mangas correspondant à sa recherche, avec titre et description courte. Utilise le prénom ${userName}. Termine par une question.`;

      const result = await this.aiRouter.ask(prompt);
      return result.content;
    }
  }

  // ============================================
  // NETTOYAGE
  // ============================================
  private cleanReply(reply: string): string {
    return reply
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '')
      .trim();
  }
}
