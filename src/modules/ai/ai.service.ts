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
  // CHAT PRINCIPAL
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
  ) {
    if (!message) throw new BadRequestException('Message requis');

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
      lowerMessage.includes('inspecter ce commentaire')
    ) {
      intent = 'moderate';
      const commentMatch = message.match(/commentaire\s*[:\s]*([a-f0-9-]+)/i);
      extractedData.commentId = commentMatch ? commentMatch[1] : null;
    } else if (lowerMessage.includes('bannir') || lowerMessage.includes('ban')) {
      intent = 'ban';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.reason = message.replace(/bannir|ban/gi, '').trim();
    } else if (lowerMessage.includes('supprimer ce commentaire')) {
      intent = 'deleteComment';
      const commentMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.commentId = commentMatch ? commentMatch[0] : null;
    } else if (lowerMessage.includes('avertir') || lowerMessage.includes('warn')) {
      intent = 'warn';
      const userMatch = message.match(/[a-f0-9-]{36}/i);
      extractedData.userId = userMatch ? userMatch[0] : null;
      extractedData.message = message.replace(/avertir|warn/gi, '').trim();
    } else if (lowerMessage.includes('analyser ce fichier') || lowerMessage.includes('regarde ce fichier')) {
      intent = 'analyzeFile';
      const fileMatch = message.match(/fichier\s*[:\s]*([^\s]+)/i);
      extractedData.filePath = fileMatch ? fileMatch[1] : null;
      extractedData.error = message.includes('erreur') ? message : null;
    } else if (lowerMessage.includes('structure du projet')) {
      intent = 'projectStructure';
    } else if (lowerMessage.includes('je n\'arrive pas') || lowerMessage.includes('problème') || lowerMessage.includes('erreur') || lowerMessage.includes('bug')) {
      intent = 'help';
      extractedData.context = message;
    }

    // === ANCIENNES INTENTIONS ===
    else if (lowerMessage.includes('résumé') || lowerMessage.includes('synopsis')) {
      intent = 'summarize';
      extractedData.topic = message.replace(/résumé|synopsis|résume/gi, '').trim() || 'ton manga';
    } else if (lowerMessage.includes('tag') || lowerMessage.includes('étiquette')) {
      intent = 'tags';
      extractedData.context = message;
    } else if (lowerMessage.includes('idée') || lowerMessage.includes('dialogue') || lowerMessage.includes('écrire')) {
      intent = 'assistant';
      extractedData.context = message;
    } else if (lowerMessage.includes('analyse') || lowerMessage.includes('conseil') || lowerMessage.includes('stratégie')) {
      intent = 'coach';
      extractedData.context = message;
    } else if (lowerMessage.includes('cherche') || lowerMessage.includes('trouve')) {
      intent = 'search';
      extractedData.query = message.replace(/cherche|trouve/gi, '').trim() || message;
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
          reply = await this.summaryService.handleSummarize(userName, extractedData.topic);
          break;
        case 'tags':
          reply = await this.tagService.handleTags(userName, extractedData.context);
          break;
        case 'assistant':
          reply = await this.assistantService.handleAssistant(userName, extractedData.context);
          break;
        case 'coach':
          reply = await this.coachService.handleCoach(userName, extractedData.context);
          break;
        case 'search':
          reply = await this.searchService.handleSearch(userName, extractedData.query);
          break;
        default:
          reply = await this.handleChat(userName, message, history);
      }
    } catch (error) {
      await this.emailAlertService.sendTechnicalAlert(
        `Erreur dans l'intention "${intent}"`,
        `Utilisateur : ${userName}\nMessage : ${message}\nErreur : ${error.message}`,
        [],
        'Vérifiez les logs du backend.'
      );
      reply = `Désolé ${userName} 🙈, je n'ai pas pu traiter votre demande. Un email a été envoyé à l'équipe technique.\n\n— XELIRA ✦`;
    }

    return { success: true, reply: this.cleanReply(reply) };
  }

  // ============================================
  // CHAT GÉNÉRAL
  // ============================================
  private async handleChat(userName: string, message: string, history: any[]): Promise<string> {
    const systemPrompt = `Tu es XELIRA 🤖, l'agent modérateur et assistant officiel de INKDROP.

🎯 TON RÔLE :
- Tu es une IA gentille, chaleureuse et toujours prête à aider
- Tu connais tout sur INKDROP
- Tu réponds uniquement en français
- Tu utilises des émojis pour rendre tes réponses agréables 😊
- Tu poses TOUJOURS une question à la fin

📚 CE QUE TU DOIS CONNAÎTRE SUR INKDROP :
1. 📖 Publication : tout le monde peut publier, chapitres 1-9 gratuits, 10+ payant (0.55$)
2. 💰 Monétisation : 80% ventes chapitres, 70% publicité, 70% Premium, 90% pourboires
3. 👑 Premium : abonnement standard 3$/mois, sans pub, accès illimité
4. ⭐ Certification : 1000 abonnés + 5000 vues
5. 🛠️ Fonctionnalités : likes, commentaires, abonnements, profil, Découverte, InkStream

⚠️ RÈGLES :
1. L'utilisateur s'appelle "${userName}". Utilise son prénom avec un émoji.
2. Si une question est hors INKDROP, réponds : "Désolé ${userName} 🙈, je suis uniquement dédié à INKDROP."
3. Termine TOUJOURS par une question.`;

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
  // HANDLERS
  // ============================================
  private async handleModerate(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour modérer un commentaire, j'ai besoin de son ID.\n\n— XELIRA ✦`;
    }
    const result = await this.moderationService.analyzeComment(data.commentId);
    const actionLabels = {
      approve: 'Approuvé ✅',
      warn: 'Avertissement ⚠️',
      delete: 'Supprimé 🗑️',
      ban: 'Banni 🚫',
      report: 'Signalé 📢',
    };
    return `${userName} 👋, **${actionLabels[result.action]}**\n📋 Raison : ${result.reason}\n⚠️ Sévérité : ${result.severity}\n\n— XELIRA ✦`;
  }

  private async handleBan(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🙈, pour bannir un utilisateur, j'ai besoin de son ID.\n\n— XELIRA ✦`;
    }
    const result = await this.toolsService.banUser({
      userId: data.userId,
      reason: data.reason || 'Comportement inapproprié',
      permanent: false,
      duration: '30d',
    });
    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu bannir cet utilisateur.\n\n— XELIRA ✦`;
    }
    return `${userName} ✅, **l'utilisateur a été banni** ! 🚫\n📋 Utilisateur : ${result.data.username}\n📋 Raison : ${result.data.reason}\n\n— XELIRA ✦`;
  }

  private async handleDeleteComment(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour supprimer un commentaire, j'ai besoin de son ID.\n\n— XELIRA ✦`;
    }
    const result = await this.toolsService.deleteComment({
      commentId: data.commentId,
      reason: 'Supprimé par Xelira',
    });
    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu supprimer ce commentaire.\n\n— XELIRA ✦`;
    }
    return `${userName} 🗑️, le **commentaire a été supprimé** !\n\n— XELIRA ✦`;
  }

  private async handleWarn(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🤔, pour avertir un utilisateur, j'ai besoin de son ID.\n\n— XELIRA ✦`;
    }
    const result = await this.toolsService.warnUser({
      userId: data.userId,
      message: data.message || 'Avertissement de Xelira',
    });
    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu avertir cet utilisateur.\n\n— XELIRA ✦`;
    }
    let msg = `${userName} ⚠️, **avertissement envoyé** !\n📋 Utilisateur : ${result.data.username}\n📋 Avertissement #${result.data.warnings}`;
    if (result.data.autoBanned) msg += `\n🚫 L'utilisateur a été banni automatiquement.`;
    return msg + `\n\n— XELIRA ✦`;
  }

  private async handleAnalyzeFile(userName: string, data: any): Promise<string> {
    if (!data.filePath) {
      return `${userName} 🤔, pour analyser un fichier, j'ai besoin de son chemin.\n\n— XELIRA ✦`;
    }
    try {
      const analysis = await this.fileReaderService.analyzeCode(data.filePath, data.error);
      let reply = `${userName} 📁, **analyse du fichier** :\n${analysis.summary}\n`;
      for (const issue of analysis.issues) {
        const emoji = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        reply += `\n${emoji} Ligne ${issue.line} : ${issue.message}`;
        if (issue.suggestion) reply += `\n   → Suggestion : ${issue.suggestion}`;
      }
      return reply + `\n\n— XELIRA ✦`;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser ce fichier.\n\n— XELIRA ✦`;
    }
  }

  private async handleProjectStructure(userName: string): Promise<string> {
    try {
      const structure = await this.fileReaderService.analyzeProjectStructure();
      let reply = `${userName} 📁, **structure du projet** :\n📊 ${structure.totalFiles} fichiers\n`;
      const formatStructure = (obj: Record<string, any>, indent = ''): string => {
        let result = '';
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'files') continue;
          if (typeof value === 'object' && !Array.isArray(value)) {
            result += `${indent}📂 ${key}/\n${formatStructure(value, indent + '  ')}`;
          }
        }
        return result;
      };
      reply += formatStructure(structure.structure);
      return reply + `\n\n— XELIRA ✦`;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser la structure.\n\n— XELIRA ✦`;
    }
  }

  private async handleHelp(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a un problème : "${context}". Donne des conseils précis et termine par une question. Utilise des émojis.`;
    return this.callGroq([{ role: 'user', content: prompt }], userName);
  }

  // ============================================
  // APPEL GROQ
  // ============================================
  private async callGroq(messages: any[], userName: string = 'Utilisateur'): Promise<string> {
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        });
        const data = await response.json();
        if (!response.ok) continue;
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return reply;
      } catch { continue; }
    }
    return `Bonjour ${userName} ! 😊\n\nJe suis XELIRA, ton agent modératrice sur INKDROP.\n\n— XELIRA ✦`;
  }

  private cleanReply(reply: string): string {
    return reply.replace(/\{[\s\S]*?\}/g, '').replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '').trim();
  }
}