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
  // CHAT PRINCIPAL AVEC DÉTECTION D'INTENTION
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

    // 1. Récupérer le nom de l'utilisateur
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

    // 2. Détecter l'intention
    const lowerMessage = message.toLowerCase();
    let intent = 'chat';
    let extractedData: any = {};

    // --- Détection des intentions ---
    
    // Résumé
    if (lowerMessage.includes('résumé') || 
        lowerMessage.includes('synopsis') || 
        lowerMessage.includes('summarize') ||
        lowerMessage.includes('raccourci')) {
      intent = 'summarize';
      extractedData.topic = message.replace(/résumé|synopsis|summarize|raccourci/gi, '').trim() || 'ton manga';
    }

    // Assistant éditeur
    else if (lowerMessage.includes('idée') || 
             lowerMessage.includes('suggestion') || 
             lowerMessage.includes('dialogue') || 
             lowerMessage.includes('écrire') ||
             lowerMessage.includes('améliorer')) {
      intent = 'assistant';
      extractedData.context = message;
    }

    // Coach
    else if (lowerMessage.includes('analyse') || 
             lowerMessage.includes('conseil') || 
             lowerMessage.includes('amélioration') ||
             lowerMessage.includes('croissance')) {
      intent = 'coach';
      extractedData.context = message;
    }

    // Recherche
    else if (lowerMessage.includes('cherche') || 
             lowerMessage.includes('trouve') || 
             lowerMessage.includes('recherche') ||
             lowerMessage.includes('manga')) {
      intent = 'search';
      extractedData.query = message.replace(/cherche|trouve|recherche|manga/gi, '').trim() || message;
    }

    // 3. Exécuter l'intention
    let reply: string;

    switch (intent) {
      case 'summarize':
        reply = await this.handleSummarize(userName, extractedData.topic);
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
    const systemPrompt = this.getSystemPrompt(userName);
    
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
  // 2. RÉSUMÉ DE CHAPITRE
  // ============================================
  private async handleSummarize(userName: string, topic: string): Promise<string> {
    const prompt = `Tu es XELIRA, l'assistant de INKDROP.

L'utilisateur ${userName} a demandé un résumé pour : "${topic}".

Génère un résumé court et accrocheur (3-4 phrases) pour ce manga/chapitre.
Le résumé doit donner envie de lire sans révéler la fin.

Résumé :`;

    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 3. ASSISTANT ÉDITEUR
  // ============================================
  private async handleAssistant(userName: string, context: string): Promise<string> {
    const prompt = `Tu es XELIRA, l'assistant d'écriture de INKDROP.

L'utilisateur ${userName} a demandé : "${context}".

Donne 3 suggestions concrètes (idées, dialogues, améliorations) pour l'aider dans son écriture.
Chaque suggestion doit être courte (1-2 phrases).

Suggestions :`;

    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 4. COACH DE CRÉATION
  // ============================================
  private async handleCoach(userName: string, context: string): Promise<string> {
    const prompt = `Tu es XELIRA, le coach de création de INKDROP.

L'utilisateur ${userName} a demandé : "${context}".

Donne 3 conseils concrets pour améliorer son travail (titre, description, stratégie, engagement).
Chaque conseil doit être précis et applicable.

Conseils :`;

    return this.callGroq([{ role: 'user', content: prompt }]);
  }

  // ============================================
  // 5. RECHERCHE INTELLIGENTE
  // ============================================
  private async handleSearch(userName: string, query: string): Promise<string> {
    const prompt = `Tu es XELIRA, le guide de INKDROP.

L'utilisateur ${userName} cherche : "${query}".

Propose 3 mangas (fictifs ou réels) qui correspondent à cette recherche.
Pour chaque manga, donne un titre et une courte description (1-2 phrases).

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

    return `Bonjour ${userName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, le modérateur de INKDROP. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`;
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
1. L'utilisateur s'appelle "${name}". Utilise son prénom.
2. Si une question est hors INKDROP, réponds : "Désolé, je suis uniquement dédié à INKDROP."
3. Sois UTILE avant d'être amical.
4. Termine chaque réponse par "— XELIRA ✦"`;
  }
}