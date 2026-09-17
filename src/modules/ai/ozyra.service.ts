// src/modules/ai/ozyra.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';
import { OzyraToolsService } from './ozyra-tools.service';
import {
  OzyraContext,
  OzyraToolCall,
  OzyraToolDefinition,
  OzyraChatResponse,
  OzyraToolUsage,
  OzyraToolName,
} from './interfaces/ai-tools.interface';

const MAX_TOOL_ITERATIONS = 3;

@Injectable()
export class OzyraService {
  private readonly logger = new Logger(OzyraService.name);

  constructor(
    private prisma: PrismaService,
    private aiRouter: AiRouterService,
    private tools: OzyraToolsService,
  ) {}

  // ============================================
  // CHAT PRINCIPAL AVEC FUNCTION CALLING
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
  ): Promise<OzyraChatResponse> {
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        reply: 'Ton message est vide.',
        error: 'EMPTY_MESSAGE',
      };
    }

    const context = await this.buildContext(userId);
    if (!context) {
      return {
        success: false,
        reply: 'Utilisateur introuvable.',
        error: 'USER_NOT_FOUND',
      };
    }

    const systemInstruction = this.buildSystemPrompt(context);

    const conversation: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      tool_call_id?: string;
      tool_calls?: any[];
    }> = [];

    for (const msg of history.slice(-10)) {
      conversation.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    conversation.push({ role: 'user', content: message });

    const toolDefinitions = this.getToolDefinitions();

    const toolsUsed: OzyraToolUsage[] = [];
    let finalReply = '';
    let provider = 'unknown';

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      this.logger.log(
        `🔄 OZYRA itération ${iteration + 1}/${MAX_TOOL_ITERATIONS}`,
      );

      let result;
      try {
        result = await this.aiRouter.call({
          messages: conversation,
          systemInstruction,
          temperature: 0.7,
          maxTokens: 1000,
          tools: toolDefinitions,
          toolChoice: 'auto',
        });
      } catch (error) {
        this.logger.error(`Erreur LLM : ${error.message}`);
        return {
          success: false,
          reply: `Désolée, je n'arrive pas à répondre pour le moment. Réessaie dans quelques secondes. 😊\n\n— OZYRA ✦`,
          error: 'LLM_FAILED',
          toolsUsed,
        };
      }

      provider = result.provider;

      let parsed: any;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        finalReply = result.content;
        break;
      }

      const toolCalls: OzyraToolCall[] = parsed.tool_calls || [];

      if (toolCalls.length === 0) {
        finalReply = parsed.content || result.content;
        break;
      }

      conversation.push({
        role: 'assistant',
        content: parsed.content || '',
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let args: any = {};

        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        this.logger.log(
          `🔧 Exécution tool "${toolName}" avec args : ${JSON.stringify(args)}`,
        );

        const toolResult = await this.tools.execute(toolName, args, context);

        toolsUsed.push({
          name: toolName,
          success: toolResult.success,
          summary: toolResult.success
            ? 'Données récupérées'
            : toolResult.error || 'Erreur',
        });

        conversation.push({
          role: 'tool',
          content: JSON.stringify(toolResult.data || { error: toolResult.error }),
          tool_call_id: toolCall.id,
        });
      }
    }

    if (!finalReply) {
      finalReply =
        "Je n'ai pas pu terminer ma réponse. Peux-tu reformuler ta question ? 😊\n\n— OZYRA ✦";
    }

    return {
      success: true,
      reply: this.cleanReply(finalReply),
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      provider,
    };
  }

  // ============================================
  // CONSTRUCTION DU CONTEXTE UTILISATEUR
  // ============================================
  private async buildContext(userId: string): Promise<OzyraContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        isCertified: true,
        manas: true,
        premiumActive: true,
        premiumPlan: true,
        premiumExpires: true,
      },
    });

    if (!user) return null;

    const ticket = await this.prisma.ticket.findUnique({
      where: { userId },
      select: { amount: true },
    });

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      premiumActive: user.premiumActive,
      premiumPlan: user.premiumPlan,
      premiumExpires: user.premiumExpires,
      manas: user.manas,
      tickets: ticket?.amount || 0,
      isCertified: user.isCertified,
    };
  }

  // ============================================
  // PROMPT SYSTÈME OZYRA AVEC CONTEXTE
  // ============================================
  private buildSystemPrompt(context: OzyraContext): string {
    const premiumStatus = context.premiumActive
      ? `Premium actif (${context.premiumPlan || 'MONTHLY'})`
      : 'Non premium';

    return `Tu es OZYRA 🤖, l'assistante officielle d'INKDROP.
Xelira Studio est l'entreprise basée à Kinshasa, RDC, qui a créé INKDROP.

📌 RÈGLES FONDAMENTALES :
1. Tu réponds UNIQUEMENT en français.
2. Tu ne parles que d'INKDROP.
3. Si la question est hors sujet → "Désolée, je suis uniquement dédiée à INKDROP."
4. Tu utilises le prénom de l'utilisateur : ${context.username}.
5. Tu termines toujours par une question ou une suggestion d'action.
6. Tu ne donnes JAMAIS de fausses informations. Si tu ne sais pas → "Je vais transmettre à l'équipe INKDROP."
7. Tu n'inventes JAMAIS de chiffres, de titres, de noms ou de statistiques.

🎯 OUTILS À TA DISPOSITION :
Tu peux appeler des fonctions pour obtenir de VRAIES données depuis la base INKDROP.
Utilise-les systématiquement quand la question porte sur :
- Des mangas (recherche, top, détails) → search_manga, get_top_mangas, get_manga_details
- Des créateurs (classement) → get_top_creators
- Le solde de l'utilisateur (MANAS) → get_user_balance
- Les tickets de l'utilisateur → get_user_tickets
- Les mangas de l'utilisateur → get_user_mangas
- Le statut Premium de l'utilisateur → get_premium_info

⛔ NE JAMAIS INVENTER : si tu as besoin d'une donnée, appelle la fonction.
Si aucune fonction ne correspond, dis-le honnêtement.

👤 CONTEXTE DE L'UTILISATEUR ACTUEL :
- Prénom : ${context.username}
- Rôle : ${context.role}
- Premium : ${premiumStatus}
- Certifié : ${context.isCertified ? 'Oui' : 'Non'}
- Solde MANAS : ${context.manas}
- Tickets : ${context.tickets}${context.premiumActive ? ' (illimités - Premium)' : ''}

💡 Utilise ces infos naturellement, sans les réciter mécaniquement.
Par exemple, si l'utilisateur est créateur, adapte ton ton.

📚 CE QUE TU SAIS SUR INKDROP :

MONNAIE : MANAS (1 MANAS ≈ 0.01 USD)
- Chapitre payant : 50 MANAS (prix fixe)
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
  // DÉFINITIONS DES TOOLS (format Groq/OpenAI)
  // ============================================
  private getToolDefinitions(): OzyraToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: OzyraToolName.SEARCH_MANGA,
          description:
            "Cherche des mangas sur INKDROP par titre, description, genre ou tag. Utilise quand l'utilisateur cherche un manga précis.",
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Termes de recherche (titre, genre, mot-clé)',
              },
              limit: {
                type: 'number',
                description: 'Nombre max de résultats (1-10, défaut 5)',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_TOP_MANGAS,
          description:
            "Retourne le classement des mangas les plus populaires sur INKDROP. Utilise quand l'utilisateur demande 'le meilleur manga', 'le top', 'les mangas populaires'.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['day', 'week', 'month', 'all'],
                description: 'Période (défaut : week)',
              },
              limit: {
                type: 'number',
                description: 'Nombre de résultats (1-10, défaut 5)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_TOP_CREATORS,
          description:
            "Retourne le classement des meilleurs créateurs sur INKDROP. Utilise quand l'utilisateur demande 'le meilleur dessinateur', 'le top créateur'.",
          parameters: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['day', 'week', 'month', 'all'],
                description: 'Période (défaut : week)',
              },
              limit: {
                type: 'number',
                description: 'Nombre de résultats (1-10, défaut 5)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_MANGA_DETAILS,
          description:
            "Retourne les détails complets d'un manga (description, auteur, stats, lien). Utilise quand l'utilisateur veut plus d'infos sur un manga précis.",
          parameters: {
            type: 'object',
            properties: {
              mangaId: {
                type: 'string',
                description: 'ID du manga (UUID)',
              },
              title: {
                type: 'string',
                description: 'Titre du manga (recherche partielle acceptée)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_USER_BALANCE,
          description:
            "Retourne le solde MANAS de l'utilisateur actuel. Utilise quand il demande 'combien j'ai de MANAS'.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_USER_TICKETS,
          description:
            "Retourne le nombre de tickets de l'utilisateur actuel. Utilise quand il demande 'combien j'ai de tickets'.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_USER_MANGAS,
          description:
            "Retourne la liste des mangas publiés par l'utilisateur actuel (s'il est créateur). Utilise quand il demande 'mes mangas', 'mes œuvres'.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: OzyraToolName.GET_PREMIUM_INFO,
          description:
            "Retourne le statut Premium de l'utilisateur (plan, expiration, rôle). Utilise quand il demande 'je suis premium ?', 'mon abonnement'.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ];
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
