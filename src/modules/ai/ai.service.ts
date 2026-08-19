// src/modules/ai/ai.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from './moderation.service';
import { ToolsService } from './tools.service';
import { FileReaderService } from './file-reader.service';
import { EmailAlertService } from './email-alert.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { AssistantService } from './assistant.service';
import { SearchService } from './search.service';
import { CoachService } from './coach.service';

@Injectable()
export class AiService {
  private readonly groqKeys: string[] = [
    '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',
    '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',
    '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',
    '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',
  ];

  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    private toolsService: ToolsService,
    private fileReaderService: FileReaderService,
    private emailAlertService: EmailAlertService,
    private summaryService: SummaryService,
    private tagService: TagService,
    private assistantService: AssistantService,
    private searchService: SearchService,
    private coachService: CoachService,
  ) {}

  // ============================================
  // CHAT PRINCIPAL - TOUTES LES FONCTIONNALITÉS
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

    // 1. Récupérer le nom
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

    // 2. Analyser le message pour détecter l'intention
    const lowerMessage = message.toLowerCase();
    let intent = 'chat';
    let extractedData: any = {};

    // ===== NOUVELLES INTENTIONS =====

    // Modération
    if (
      lowerMessage.includes('modérer') ||
      lowerMessage.includes('analyser ce commentaire') ||
      lowerMessage.includes('inspecter ce commentaire') ||
      lowerMessage.includes('vérifier ce commentaire')
    ) {
      intent = 'moderate';
      const commentMatch = message.match(/commentaire\s*[:\s]*([a-f0-9-]+)/i);
      extractedData.commentId = commentMatch ? commentMatch[1] : null;
      extractedData.context = message;
    }

    // Bannir
    else if (
      lowerMessage.includes('bannir') ||
      lowerMessage.includes('ban') ||
      lowerMessage.includes('supprimer ce compte')
    ) {
      intent = 'ban';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.reason = message.replace(/bannir|ban|supprimer ce compte/gi, '').trim();
    }

    // Supprimer commentaire
    else if (
      lowerMessage.includes('supprimer ce commentaire') ||
      lowerMessage.includes('effacer ce commentaire')
    ) {
      intent = 'deleteComment';
      const commentMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.commentId = commentMatch ? commentMatch[0] : null;
    }

    // Avertir
    else if (
      lowerMessage.includes('avertir') ||
      lowerMessage.includes('warn')
    ) {
      intent = 'warn';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.message = message.replace(/avertir|warn/gi, '').trim();
    }

    // Analyser un fichier
    else if (
      lowerMessage.includes('analyser ce fichier') ||
      lowerMessage.includes('regarde ce fichier') ||
      lowerMessage.includes('inspecter ce fichier')
    ) {
      intent = 'analyzeFile';
      const fileMatch = message.match(/fichier\s*[:\s]*([^\s]+)/i);
      extractedData.filePath = fileMatch ? fileMatch[1] : null;
      extractedData.error = message.includes('erreur') ? message : null;
    }

    // Structure du projet
    else if (
      lowerMessage.includes('structure du projet') ||
      lowerMessage.includes('architecture du projet') ||
      lowerMessage.includes('organisation du projet')
    ) {
      intent = 'projectStructure';
    }

    // Support / Aide
    else if (
      lowerMessage.includes('je n\'arrive pas') ||
      lowerMessage.includes('ça ne marche pas') ||
      lowerMessage.includes('problème') ||
      lowerMessage.includes('erreur') ||
      lowerMessage.includes('bug')
    ) {
      intent = 'help';
      extractedData.context = message;
    }

    // ===== ANCIENNES INTENTIONS =====

    // Résumé
    else if (lowerMessage.includes('résumé') || lowerMessage.includes('synopsis') || lowerMessage.includes('résume')) {
      intent = 'summarize';
      extractedData.topic = message.replace(/résumé|synopsis|résume/gi, '').trim() || 'ton manga';
    }
    // Tags
    else if (lowerMessage.includes('tag') || lowerMessage.includes('étiquette') || lowerMessage.includes('catégorie')) {
      intent = 'tags';
      extractedData.context = message;
    }
    // Assistant
    else if (lowerMessage.includes('idée') || lowerMessage.includes('dialogue') || lowerMessage.includes('écrire') || lowerMessage.includes('améliorer')) {
      intent = 'assistant';
      extractedData.context = message;
    }
    // Coach
    else if (lowerMessage.includes('analyse') || lowerMessage.includes('conseil') || lowerMessage.includes('croissance') || lowerMessage.includes('stratégie')) {
      intent = 'coach';
      extractedData.context = message;
    }
    // Recherche
    else if (lowerMessage.includes('cherche') || lowerMessage.includes('trouve') || lowerMessage.includes('recherche')) {
      intent = 'search';
      extractedData.query = message.replace(/cherche|trouve|recherche/gi, '').trim() || message;
    }

    // 3. Exécuter l'intention
    let reply: string;

    try {
      switch (intent) {
        // ===== NOUVELLES INTENTIONS =====
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

        // ===== ANCIENNES INTENTIONS =====
        case 'summarize':
          reply = await this.summaryService.generate(userName, extractedData.topic);
          break;
        case 'tags':
          reply = await this.tagService.generate(userName, extractedData.context);
          break;
        case 'assistant':
          reply = await this.assistantService.generate(userName, extractedData.context);
          break;
        case 'coach':
          reply = await this.coachService.generate(userName, extractedData.context);
          break;
        case 'search':
          reply = await this.searchService.search(userName, extractedData.query);
          break;
        default:
          reply = await this.handleChat(userName, message, history);
      }
    } catch (error) {
      // Si l'IA est bloquée, envoyer un email
      await this.emailAlertService.sendTechnicalAlert(
        `Erreur dans l'intention "${intent}"`,
        `Utilisateur : ${userName}\nMessage : ${message}\nErreur : ${error.message}`,
        [],
        'Vérifiez les logs du backend pour plus de détails.'
      );

      reply = `Désolé ${userName}, je n'ai pas pu traiter votre demande. Un email a été envoyé à l'équipe technique. Veuillez réessayer dans quelques minutes. — XELIRA ✦`;
    }

    return { success: true, reply: this.cleanReply(reply) };
  }

  // ============================================
  // NOUVELLES MÉTHODES
  // ============================================

  // 1. MODÉRATION
  private async handleModerate(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName}, pour modérer un commentaire, j'ai besoin de son ID. Pouvez-vous me le donner ? — XELIRA ✦`;
    }

    const result = await this.moderationService.analyzeComment(data.commentId);

    const actionEmojis = {
      approve: '✅',
      warn: '⚠️',
      delete: '🗑️',
      ban: '🚫',
      report: '📢',
    };

    const actionLabels = {
      approve: 'Approuvé',
      warn: 'Avertissement envoyé',
      delete: 'Commentaire supprimé',
      ban: 'Utilisateur banni',
      report: 'Signalé aux admins',
    };

    const severityLabels = {
      low: '🟢 Basse',
      medium: '🟡 Moyenne',
      high: '🟠 Haute',
      critical: '🔴 Critique',
    };

    return `${userName}, ${actionEmojis[result.action]} **${actionLabels[result.action]}**\n\n📋 Raison : ${result.reason}\n⚠️ Sévérité : ${severityLabels[result.severity]}\n🎯 Confiance : ${Math.round(result.confidence * 100)}%\n${result.requiresHumanReview ? '\n👨‍💼 Une révision humaine est recommandée.' : ''}\n\n— XELIRA ✦`;
  }

  // 2. BANNIR
  private async handleBan(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName}, pour bannir un utilisateur, j'ai besoin de son ID. Pouvez-vous me le donner ? — XELIRA ✦`;
    }

    const result = await this.toolsService.banUser({
      userId: data.userId,
      reason: data.reason || 'Comportement inapproprié (décision Xelira)',
      permanent: false,
      duration: '30d',
    });

    if (!result.success) {
      return `${userName}, je n'ai pas pu bannir cet utilisateur. ${result.message} — XELIRA ✦`;
    }

    return `${userName}, ✅ **Utilisateur banni avec succès**\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Raison : ${result.data.reason}\n• Date : ${new Date(result.data.bannedAt).toLocaleString('fr-FR')}\n\n— XELIRA ✦`;
  }

  // 3. SUPPRIMER UN COMMENTAIRE
  private async handleDeleteComment(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName}, pour supprimer un commentaire, j'ai besoin de son ID. Pouvez-vous me le donner ? — XELIRA ✦`;
    }

    const result = await this.toolsService.deleteComment({
      commentId: data.commentId,
      reason: 'Supprimé par Xelira (IA)',
    });

    if (!result.success) {
      return `${userName}, je n'ai pas pu supprimer ce commentaire. ${result.message} — XELIRA ✦`;
    }

    return `${userName}, 🗑️ **Commentaire supprimé avec succès**\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Commentaire ID : ${result.data.commentId}\n\n— XELIRA ✦`;
  }

  // 4. AVERTIR
  private async handleWarn(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName}, pour avertir un utilisateur, j'ai besoin de son ID. Pouvez-vous me le donner ? — XELIRA ✦`;
    }

    const result = await this.toolsService.warnUser({
      userId: data.userId,
      message: data.message || 'Avertissement de Xelira (IA)',
    });

    if (!result.success) {
      return `${userName}, je n'ai pas pu avertir cet utilisateur. ${result.message} — XELIRA ✦`;
    }

    let message = `${userName}, ⚠️ **Avertissement envoyé**\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Avertissement #${result.data.warnings}\n`;

    if (result.data.autoBanned) {
      message += `\n🚫 **L'utilisateur a été banni automatiquement** (3 avertissements).`;
    }

    return message + '\n\n— XELIRA ✦';
  }

  // 5. ANALYSER UN FICHIER
  private async handleAnalyzeFile(userName: string, data: any): Promise<string> {
    if (!data.filePath) {
      return `${userName}, pour analyser un fichier, j'ai besoin de son chemin (ex: src/modules/ai/ai.service.ts). Pouvez-vous me le donner ? — XELIRA ✦`;
    }

    try {
      const analysis = await this.fileReaderService.analyzeCode(
        data.filePath,
        data.error || undefined
      );

      let reply = `${userName}, 📁 **Analyse du fichier**\n\n`;
      reply += analysis.summary + '\n\n';

      if (analysis.issues.length > 0) {
        reply += '🔍 **Problèmes détectés :**\n';
        for (const issue of analysis.issues) {
          const emoji = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
          reply += `  ${emoji} Ligne ${issue.line} : ${issue.message}\n`;
          if (issue.suggestion) {
            reply += `     → Suggestion : ${issue.suggestion}\n`;
          }
        }
      } else {
        reply += '✅ Aucun problème détecté dans ce fichier.\n';
      }

      return reply + '\n— XELIRA ✦';
    } catch (error) {
      return `${userName}, je n'ai pas pu analyser ce fichier. Erreur : ${error.message}\n\n— XELIRA ✦`;
    }
  }

  // 6. STRUCTURE DU PROJET
  private async handleProjectStructure(userName: string): Promise<string> {
    try {
      const structure = await this.fileReaderService.analyzeProjectStructure();

      let reply = `${userName}, 📁 **Structure du projet**\n\n`;
      reply += `📊 Total : ${structure.totalFiles} fichiers\n\n`;

      const formatStructure = (obj: Record<string, any>, indent: string = ''): string => {
        let result = '';
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'files') {
            // Ne pas afficher tous les fichiers individuellement
            continue;
          }
          if (typeof value === 'object' && !Array.isArray(value)) {
            result += `${indent}📂 ${key}/\n`;
            result += formatStructure(value, indent + '  ');
          }
        }
        return result;
      };

      reply += formatStructure(structure.structure);
      reply += `\n📝 ${structure.files.length} fichiers affichés (sur ${structure.totalFiles})`;

      return reply + '\n\n— XELIRA ✦';
    } catch (error) {
      return `${userName}, je n'ai pas pu analyser la structure du projet. Erreur : ${error.message}\n\n— XELIRA ✦`;
    }
  }

  // 7. AIDE
  private async handleHelp(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a un problème : "${context || 'problème technique'}".

Donne des conseils pour résoudre ce problème.
Sois précis et utile.
Termine par une question pour en savoir plus.`;

    return this.callGroq([{ role: 'user', content: prompt }], userName);
  }

  // ============================================
  // CHAT GÉNÉRAL (EXISTANT)
  // ============================================
  private async handleChat(userName: string, message: string, history: any[]): Promise<string> {
    const systemPrompt = `Tu es XELIRA, le modérateur et guide officiel de INKDROP.

🎯 TON RÔLE :
- Tu connais tout sur INKDROP
- Tu réponds uniquement en français
- Tu es professionnel, précis et concis
- Tu n'abordes jamais de sujets hors INKDROP

📚 CE QUE TU DOIS CONNAÎTRE :
1. Publication : tout le monde peut publier, chapitres 1-9 gratuits, 10+ payant (0.55$)
2. Monétisation : 80% ventes chapitres, 70% publicité, 70% Premium, 90% pourboires
3. Premium : 2$/mois, sans pub, accès illimité
4. Certification : 1000 abonnés + 5000 vues
5. Fonctionnalités : likes, commentaires, abonnements, profil, Découverte, InkStream

⚠️ RÈGLES STRICTES :
1. L'utilisateur s'appelle "${userName}". Utilise son prénom à CHAQUE message.
2. Si une question est hors INKDROP, réponds : "Désolé, je suis uniquement dédié à INKDROP."
3. Sois UTILE avant d'être amical.
4. Termine chaque réponse par "— XELIRA ✦"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    return this.callGroq(messages, userName);
  }

  // ============================================
  // APPEL GROQ (EXISTANT)
  // ============================================
  private async callGroq(messages: any[], userName: string = 'Utilisateur'): Promise<string> {
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return reply;
        }
      } catch (error) {
        continue;
      }
    }

    return `Bonjour ${userName} ! 😊\n\nJe suis XELIRA, le modérateur de INKDROP. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`;
  }

  // ============================================
  // NETTOYAGE (EXISTANT)
  // ============================================
  private cleanReply(reply: string): string {
    return reply
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '')
      .trim();
  }
}