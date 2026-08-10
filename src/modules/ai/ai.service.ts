import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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
    if (!userName) {
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

    // Résumé
    if (lowerMessage.includes('résumé') || lowerMessage.includes('synopsis') || lowerMessage.includes('résume')) {
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

    switch (intent) {
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

    return { success: true, reply: this.cleanReply(reply) };
  }

  // ============================================
  // 1. CHAT GÉNÉRAL
  // ============================================
  private async handleChat(userName: string, message: string, history: any[]): Promise<string> {
    const systemPrompt = `Tu es XELIRA, le modérateur et guide officiel de INKDROP.

L'utilisateur s'appelle "${userName}". Utilise son prénom.

RÈGLES :
- Réponds en français, professionnel et concis
- Si une question est hors INKDROP, réponds : "Désolé, je suis uniquement dédié à INKDROP."
- Termine par "— XELIRA ✦"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    return this.callGroq(messages);
  }

  // ============================================
  // 2. RÉSUMÉ
  // ============================================
  private async handleSummarize(userName: string, topic: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé un résumé pour : "${topic}".

Génère un résumé court (3-4 phrases), accrocheur, sans révéler la fin.

Résumé :`;
    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 3. TAGS
  // ============================================
  private async handleTags(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé des tags pour : "${context}".

Propose 5 tags courts (1-2 mots), séparés par des virgules.

Tags :`;
    const reply = await this.callGroq([{ role: 'user', content: prompt }]);
    const tags = reply.split(',').map(t => t.trim()).filter(t => t.length > 0).slice(0, 5);
    return `🏷️ Voici 5 tags pertinents :\n\n${tags.map((t, i) => `• ${t}`).join('\n')}\n\n— XELIRA ✦`;
  }

  // ============================================
  // 4. ASSISTANT
  // ============================================
  private async handleAssistant(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé : "${context}".

Donne 3 suggestions concrètes (idées, dialogues, améliorations) courtes.

Suggestions :`;
    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 5. COACH
  // ============================================
  private async handleCoach(userName: string, context: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} a demandé : "${context}".

Donne 3 conseils concrets pour améliorer son travail.

Conseils :`;
    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 6. RECHERCHE
  // ============================================
  private async handleSearch(userName: string, query: string): Promise<string> {
    const prompt = `L'utilisateur ${userName} cherche : "${query}".

Propose 3 mangas correspondant à sa recherche, avec titre et description courte.

Résultats :`;
    return this.callGroq([{ role: 'user', content: prompt }]);
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
          const reply = data.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      } catch (error) {
        continue;
      }
    }

    return `Bonjour ! Je suis XELIRA. Comment puis-je t'aider ?\n\n— XELIRA ✦`;
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