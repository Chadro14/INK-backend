import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
    private summaryService: SummaryService,
    private tagService: TagService,
    private assistantService: AssistantService,
    private searchService: SearchService,
    private coachService: CoachService,
  ) {}

  // ============================================
  // CHAT INTELLIGENT - DÉTECTE AUTOMATIQUEMENT L'INTENTION
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

    const lowerMessage = message.toLowerCase();

    // 1. Détecter l'intention
    const intent = this.detectIntent(lowerMessage);

    // 2. Exécuter l'action appropriée
    switch (intent) {
      case 'summarize':
        return this.handleSummarize(userId, message, firstName);
      
      case 'assistant':
        return this.handleAssistant(userId, message, firstName);
      
      case 'coach':
        return this.handleCoach(userId, message, firstName);
      
      case 'search':
        return this.handleSearch(userId, message, firstName);
      
      default:
        return this.handleChat(userId, message, history, firstName);
    }
  }

  // ============================================
  // DÉTECTION D'INTENTION
  // ============================================
  private detectIntent(message: string): string {
    // Mots-clés pour le résumé
    const summaryKeywords = ['résume', 'résumé', 'summarize', 'synthèse', 'raccourci'];
    if (summaryKeywords.some(k => message.includes(k))) {
      return 'summarize';
    }

    // Mots-clés pour l'assistant
    const assistantKeywords = ['idée', 'suggestion', 'dialogue', 'écrire', 'réécrire', 'améliorer'];
    if (assistantKeywords.some(k => message.includes(k))) {
      return 'assistant';
    }

    // Mots-clés pour le coach
    const coachKeywords = ['analyse', 'conseil', 'amélioration', 'croissance', 'statistique'];
    if (coachKeywords.some(k => message.includes(k))) {
      return 'coach';
    }

    // Mots-clés pour la recherche
    const searchKeywords = ['cherche', 'trouve', 'recherche', 'manga', 'histoire'];
    if (searchKeywords.some(k => message.includes(k)) && message.length > 10) {
      return 'search';
    }

    return 'chat';
  }

  // ============================================
  // GESTION DES INTENTIONS
  // ============================================

  private async handleChat(userId: string, message: string, history: any[], firstName: string) {
    // Récupérer le nom
    let userName = firstName;
    if (!userName) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      userName = user?.username || 'Utilisateur';
    }

    const systemPrompt = this.getSystemPrompt(userName);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const reply = await this.callGroq(messages);
    return { success: true, reply: this.cleanReply(reply) };
  }

  private async handleSummarize(userId: string, message: string, firstName: string) {
    // Extraire le titre du manga si mentionné
    const mangaTitle = message.replace(/résume|résumé|summarize|synthèse|raccourci/gi, '').trim() || 'le manga';
    
    const prompt = `L'utilisateur ${firstName || 'cher utilisateur'} a demandé un résumé pour "${mangaTitle}".

Règle : Génère un court résumé (3-4 phrases) de ce manga fictif pour donner envie de le lire.

Résumé :`;
    
    const reply = await this.callGroq([{ role: 'user', content: prompt }]);
    return { success: true, reply: this.cleanReply(reply) };
  }

  private async handleAssistant(userId: string, message: string, firstName: string) {
    const prompt = `L'utilisateur ${firstName || 'cher utilisateur'} a demandé de l'aide pour écrire : "${message}".

Propose 3 suggestions d'amélioration ou d'idées pour l'aider.`;
    
    const reply = await this.callGroq([{ role: 'user', content: prompt }]);
    return { success: true, reply: this.cleanReply(reply) };
  }

  private async handleCoach(userId: string, message: string, firstName: string) {
    const prompt = `L'utilisateur ${firstName || 'cher utilisateur'} a demandé une analyse : "${message}".

Donne 3 conseils concrets pour améliorer son travail et sa stratégie.`;
    
    const reply = await this.callGroq([{ role: 'user', content: prompt }]);
    return { success: true, reply: this.cleanReply(reply) };
  }

  private async handleSearch(userId: string, message: string, firstName: string) {
    const prompt = `L'utilisateur ${firstName || 'cher utilisateur'} cherche des mangas sur : "${message}".

Propose 3 mangas (fictifs ou existants) qui correspondent à sa recherche, avec une courte description pour chacun.`;
    
    const reply = await this.callGroq([{ role: 'user', content: prompt }]);
    return { success: true, reply: this.cleanReply(reply) };
  }

  // ============================================
  // APPEL GROQ
  // ============================================
  private async callGroq(messages: any[]): Promise<string> {
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
        if (response.ok) {
          return data.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';
        }
      } catch (error) {
        continue;
      }
    }

    return 'Désolé, tous mes services sont occupés. Réessaie dans un instant !';
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

  // ============================================
  // PROMPT SYSTÈME
  // ============================================
  private getSystemPrompt(firstName: string): string {
    const name = firstName || 'Cher utilisateur';
    return `Tu es XELIRA, le modérateur et guide officiel de INKDROP.

Tu connais tout sur INKDROP : comment publier, les revenus, la certification, le Premium.

L'utilisateur s'appelle "${name}".

RÈGLES :
- Réponds en français
- Sois professionnel et concis
- Si une question est hors INKDROP, réponds : "Désolé, je suis uniquement dédié à INKDROP."
- Termine par "— XELIRA ✦"`;
  }
}