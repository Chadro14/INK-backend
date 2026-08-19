// src/modules/ai/ai.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
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
    private searchService: SearchService,
    private assistantService: AssistantService,
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
      extractedData.reason = message.replace(/bannir|ban|supprimer ce compte/gi, '').trim();
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
      lowerMessage.includes('je n\'arrive pas') ||
      lowerMessage.includes('ça ne marche pas') ||
      lowerMessage.includes('problème') ||
      lowerMessage.includes('erreur') ||
      lowerMessage.includes('bug')
    ) {
      intent = 'help';
      extractedData.context = message;
    }

    // === ANCIENNES INTENTIONS ===
    else if (lowerMessage.includes('résumé') || lowerMessage.includes('synopsis') || lowerMessage.includes('résume')) {
      intent = 'summarize';
      extractedData.topic = message.replace(/résumé|synopsis|résume/gi, '').trim() || 'ton manga';
    } else if (lowerMessage.includes('tag') || lowerMessage.includes('étiquette') || lowerMessage.includes('catégorie')) {
      intent = 'tags';
      extractedData.context = message;
    } else if (lowerMessage.includes('idée') || lowerMessage.includes('dialogue') || lowerMessage.includes('écrire') || lowerMessage.includes('améliorer')) {
      intent = 'assistant';
      extractedData.context = message;
    } else if (lowerMessage.includes('analyse') || lowerMessage.includes('conseil') || lowerMessage.includes('croissance') || lowerMessage.includes('stratégie')) {
      intent = 'coach';
      extractedData.context = message;
    } else if (lowerMessage.includes('cherche') || lowerMessage.includes('trouve') || lowerMessage.includes('recherche')) {
      intent = 'search';
      extractedData.query = message.replace(/cherche|trouve|recherche/gi, '').trim() || message;
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
      console.error('❌ ERREUR DANS AI SERVICE :', error);
      console.error('📋 MESSAGE :', error.message);
      console.error('📋 STACK :', error.stack);
      
      await this.emailAlertService.sendTechnicalAlert(
        `Erreur dans l'intention "${intent}"`,
        `Utilisateur : ${userName}\nMessage : ${message}\nErreur : ${error.message}`,
        [],
        'Vérifiez les logs du backend pour plus de détails.'
      );
      reply = `Désolé ${userName} 🙈, je n'ai pas pu traiter votre demande. Un email a été envoyé à l'équipe technique. Veuillez réessayer dans quelques minutes. 😊\n\n— XELIRA ✦`;
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
- Tu es professionnelle mais accessible
- Tu poses TOUJOURS une question à la fin pour engager la conversation

📚 CE QUE TU DOIS CONNAÎTRE SUR INKDROP :
1. 📖 Publication : tout le monde peut publier, chapitres 1-9 gratuits, 10+ payant (0.55$)
2. 💰 Monétisation : 80% ventes chapitres, 70% publicité, 70% Premium, 90% pourboires
3. 👑 Premium : 2$/mois, sans pub, accès illimité
4. ⭐ Certification : 1000 abonnés + 5000 vues
5. 🛠️ Fonctionnalités : likes, commentaires, abonnements, profil, Découverte, InkStream
6. 🤖 Xelira : je suis ton agent modérateur, je veille sur la communauté

⚠️ RÈGLES STRICTES :
1. L'utilisateur s'appelle "${userName}". Utilise son prénom à CHAQUE message avec un émoji.
2. Si une question est hors INKDROP, réponds : "Désolé ${userName} 🙈, je suis uniquement dédié à INKDROP. Tu veux que je t'aide sur un sujet lié à la plateforme ?"
3. Sois UTILE avant d'être amical.
4. Termine TOUJOURS par une question pour continuer la discussion.

📋 EXEMPLE DE RÉPONSE :
"Bonjour ${userName} ! 😊 Comment puis-je t'aider aujourd'hui sur INKDROP ? Dis-moi tout !"

"Salut ${userName} 👋, ravi de te voir ! Besoin d'aide pour publier ton manga ou autre chose ?"

"Je vois que tu as une question sur la certification ${userName} ⭐. C'est une excellente démarche ! Pour être certifié, il te faut 1000 abonnés et 5000 vues. Tu en es où dans ton parcours ?"

RÈGLE D'OR : Sois toujours gentille, souriante, et termine chaque message par une question. 😊✨`;

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
  // HANDLER : MODÉRATION
  // ============================================
  private async handleModerate(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour modérer un commentaire, j'ai besoin de son ID. Peux-tu me le donner stp ? 😊\n\n— XELIRA ✦`;
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

    return `${userName} 👋, ${actionEmojis[result.action] || '✅'} **${actionLabels[result.action] || 'Traité'}**\n\n📋 Raison : ${result.reason}\n⚠️ Sévérité : ${severityLabels[result.severity] || 'Basse'}\n🎯 Confiance : ${Math.round(result.confidence * 100)}%\n${result.requiresHumanReview ? '\n👨‍💼 Une révision humaine est recommandée.' : ''}\n\nEst-ce que tout est clair pour toi ? 😊\n\n— XELIRA ✦`;
  }

  // ============================================
  // HANDLER : BANNIR
  // ============================================
  private async handleBan(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🙈, pour bannir un utilisateur, j'ai besoin de son ID. Peux-tu me le donner ?\n\n— XELIRA ✦`;
    }

    const result = await this.toolsService.banUser({
      userId: data.userId,
      reason: data.reason || 'Comportement inapproprié (décision Xelira)',
      permanent: false,
      duration: '30d',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu bannir cet utilisateur. ${result.message}\n\nTu veux que je t'aide à autre chose ? 😊\n\n— XELIRA ✦`;
    }

    return `${userName} ✅, **l'utilisateur a été banni avec succès** ! 🚫\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Raison : ${result.data.reason}\n• Date : ${new Date(result.data.bannedAt).toLocaleString('fr-FR')}\n\nTu as d'autres questions ? 😊\n\n— XELIRA ✦`;
  }

  // ============================================
  // HANDLER : SUPPRIMER UN COMMENTAIRE
  // ============================================
  private async handleDeleteComment(userName: string, data: any): Promise<string> {
    if (!data.commentId) {
      return `${userName} 🤔, pour supprimer un commentaire, j'ai besoin de son ID. Tu peux me le donner ?\n\n— XELIRA ✦`;
    }

    const result = await this.toolsService.deleteComment({
      commentId: data.commentId,
      reason: 'Supprimé par Xelira (IA)',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu supprimer ce commentaire. ${result.message}\n\nTu veux que je t'aide sur autre chose ? 😊\n\n— XELIRA ✦`;
    }

    return `${userName} 🗑️, le **commentaire a été supprimé avec succès** !\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Commentaire ID : ${result.data.commentId}\n\nBesoin d'autre chose ? 😊\n\n— XELIRA ✦`;
  }

  // ============================================
  // HANDLER : AVERTIR
  // ============================================
  private async handleWarn(userName: string, data: any): Promise<string> {
    if (!data.userId) {
      return `${userName} 🤔, pour avertir un utilisateur, j'ai besoin de son ID. Tu peux me le donner ?\n\n— XELIRA ✦`;
    }

    const result = await this.toolsService.warnUser({
      userId: data.userId,
      message: data.message || 'Avertissement de Xelira (IA)',
    });

    if (!result.success) {
      return `${userName} 😕, je n'ai pas pu avertir cet utilisateur. ${result.message}\n\nTu veux que je t'aide autrement ? 😊\n\n— XELIRA ✦`;
    }

    let message = `${userName} ⚠️, **l'avertissement a été envoyé** !\n\n📋 Détails :\n• Utilisateur : ${result.data.username}\n• Avertissement #${result.data.warnings}\n`;

    if (result.data.autoBanned) {
      message += `\n🚫 **L'utilisateur a été banni automatiquement** (3 avertissements).`;
    }

    message += `\n\nTu as d'autres questions ? 😊\n\n— XELIRA ✦`;
    return message;
  }

  // ============================================
  // HANDLER : ANALYSER UN FICHIER
  // ============================================
  private async handleAnalyzeFile(userName: string, data: any): Promise<string> {
    if (!data.filePath) {
      return `${userName} 🤔, pour analyser un fichier, j'ai besoin de son chemin (ex: src/modules/ai/ai.service.ts). Tu peux me le donner ?\n\n— XELIRA ✦`;
    }

    try {
      const analysis = await this.fileReaderService.analyzeCode(
        data.filePath,
        data.error || undefined
      );

      let reply = `${userName} 📁, **voici l'analyse du fichier** :\n\n`;
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
        reply += '✅ Aucun problème détecté dans ce fichier !\n';
      }

      reply += `\nEst-ce que ça t'aide ? 😊\n\n— XELIRA ✦`;
      return reply;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser ce fichier. Erreur : ${error.message}\n\nTu veux que j'essaie autre chose ? 😊\n\n— XELIRA ✦`;
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

      const formatStructure = (obj: Record<string, any>, indent: string = ''): string => {
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

      reply += `\n\nEst-ce que ça répond à ta question ? 😊\n\n— XELIRA ✦`;
      return reply;
    } catch (error) {
      return `${userName} 😕, je n'ai pas pu analyser la structure du projet. Erreur : ${error.message}\n\nTu veux que je fasse autre chose ? 😊\n\n— XELIRA ✦`;
    }
  }

  // ============================================
  // HANDLER : AIDE
  // ============================================
  private async handleHelp(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a un problème : "${context || 'problème technique'}".

Donne des conseils pour résoudre ce problème.
Sois précis et utile.
Termine par une question pour en savoir plus.
Utilise des émojis pour rendre la réponse agréable.`;

    return this.callGroq([{ role: 'user', content: prompt }], userName);
  }

  // ============================================
  // HANDLER : RÉSUMÉ
  // ============================================
  private async handleSummarize(userName: string, topic: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé un résumé pour : "${topic}".

Génère un résumé court (3-4 phrases), accrocheur, sans révéler la fin.
Utilise le prénom ${userName} dans ta réponse.
Termine par une question pour savoir si c'est utile.

Résumé :`;

    return this.callGroq([{ role: 'user', content: prompt }], userName);
  }

  // ============================================
  // HANDLER : TAGS
  // ============================================
  private async handleTags(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé des tags pour : "${context}".

Propose 5 tags courts (1-2 mots), séparés par des virgules.
Utilise le prénom ${userName} dans ta réponse.

Tags :`;

    const reply = await this.callGroq([{ role: 'user', content: prompt }], userName);
    const tags = reply.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 5);
    return `🏷️ ${userName}, voici 5 tags pertinents :\n\n${tags.map((t: string, i: number) => `• ${t}`).join('\n')}\n\nCes tags correspondent-ils à ce que tu cherchais ? 😊\n\n— XELIRA ✦`;
  }

    // ============================================
  // HANDLER : ASSISTANT
  // ============================================
  private async handleAssistant(userName: string, context: string): Promise<string> {
    try {
      const result = await this.assistantService.suggestIdeas(
        context,
        [],
        'Non spécifié'
      );
      return `${result}\n\nEst-ce que ces idées t'inspirent ? 😊\n\n— XELIRA ✦`;
    } catch (error) {
      const prompt = `L'utilisateur ${userName} a demandé : "${context}". Donne 3 suggestions concrètes (idées, dialogues, améliorations) courtes. Utilise le prénom ${userName}. Termine par une question.`;
      return this.callGroq([{ role: 'user', content: prompt }], userName);
    }
  }

  // ============================================
  // HANDLER : COACH
  // ============================================
  private async handleCoach(userName: string, context: string): Promise<string> {
    try {
      const result = await this.coachService.suggestImprovements(
        'Manga sans titre',
        context || 'Aucune description',
        []
      );
      return `${result}\n\nEst-ce que ces conseils t'aident ? 😊\n\n— XELIRA ✦`;
    } catch (error) {
      const prompt = `L'utilisateur ${userName} a demandé : "${context}". Donne 3 conseils concrets pour améliorer son travail. Utilise le prénom ${userName}. Termine par une question.`;
      return this.callGroq([{ role: 'user', content: prompt }], userName);
    }
  }

  // ============================================
  // HANDLER : RECHERCHE
  // ============================================
  private async handleSearch(userName: string, query: string): Promise<string> {
    try {
      const results = await this.searchService.intelligentSearch(query, 5);
      if (results.length === 0) {
        return `${userName} 🔍, je n'ai trouvé aucun manga correspondant à "${query}". Essaie d'autres mots-clés ! 😊\n\n— XELIRA ✦`;
      }
      let reply = `${userName} 🔍, voici les résultats pour "${query}" :\n\n`;
      for (const manga of results.slice(0, 5)) {
        reply += `📖 **${manga.title}**\n`;
        reply += `   👤 ${manga.author?.username || 'Inconnu'}\n`;
        reply += `   ❤️ ${manga._count?.likes || 0} likes\n`;
        reply += `   📚 ${manga._count?.chapters || 0} chapitres\n\n`;
      }
      reply += `Tu veux plus de détails sur l'un d'eux ? 😊\n\n— XELIRA ✦`;
      return reply;
    } catch (error) {
      const prompt = `L'utilisateur ${userName} cherche : "${query}". Propose 3 mangas correspondant à sa recherche, avec titre et description courte. Utilise le prénom ${userName}. Termine par une question.`;
      return this.callGroq([{ role: 'user', content: prompt }], userName);
    }
  }

  // ============================================
  // APPEL GROQ (CORRIGÉ AVEC LE BON MODÈLE)
  // ============================================
  private async callGroq(messages: any[], userName: string = 'Utilisateur'): Promise<string> {
    console.log(`📤 Appel Groq - ${messages.length} messages, ${this.groqKeys.length} clés disponibles`);
    console.log(`📤 URL : ${this.apiUrl}`);

    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        console.log(`🔑 Tentative ${attempt + 1}/${this.groqKeys.length} - Clé : ${key.substring(0, 15)}...`);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b', // ✅ MODÈLE CORRIGÉ
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`❌ Erreur Groq (${response.status}) :`, JSON.stringify(data, null, 2));
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          console.log(`✅ Réponse Groq reçue (${reply.length} caractères)`);
          return reply;
        } else {
          console.error('❌ Pas de reply dans la réponse:', data);
        }
      } catch (error) {
        console.error(`❌ Exception Groq :`, error.message);
      }
    }

    console.error('❌ TOUTES LES TENTATIVES GROQ ONT ÉCHOUÉ');
    return `Bonjour ${userName} ! 😊✨\n\nJe suis XELIRA, ton agent modérateur sur INKDROP. Comment puis-je t'aider aujourd'hui ? Dis-moi tout ! 🚀\n\n— XELIRA ✦`;
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