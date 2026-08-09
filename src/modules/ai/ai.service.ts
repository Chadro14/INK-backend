import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import WebSocket from 'ws'; // ✅ IMPORT CORRIGÉ

@Injectable()
export class AiService {
  private readonly copilotUrl = 'https://copilot.microsoft.com';

  // ============================================
  // CHAT AVEC COPILOT (Microsoft)
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
    model: string = 'default',
  ) {
    if (!message) {
      throw new BadRequestException('Message requis');
    }

    try {
      const headers = {
        'origin': 'https://copilot.microsoft.com',
        'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36',
      };

      const { data } = await axios.post(
        `${this.copilotUrl}/c/api/conversations`,
        null,
        { headers }
      );

      const conversationId = data.id;

      const models = {
        default: 'chat',
        'think-deeper': 'reasoning',
        'gpt-5': 'smart',
      };

      const mode = models[model] || 'chat';

      const response = await new Promise((resolve, reject) => {
        const ws = new WebSocket(
          `wss://copilot.microsoft.com/c/api/chat?api-version=2&features=-,ncedge,edgepagecontext&setflight=-,ncedge,edgepagecontext&ncedge=1`,
          { headers }
        );

        let reply = '';
        let citations = [];

        ws.on('open', () => {
          ws.send(JSON.stringify({
            event: 'setOptions',
            supportedFeatures: ['partial-generated-images'],
            supportedCards: ['weather', 'local', 'image', 'sports', 'video', 'ads'],
            ads: {
              supportedTypes: ['text', 'product', 'multimedia']
            }
          }));

          ws.send(JSON.stringify({
            event: 'send',
            mode: mode,
            conversationId,
            content: [{ type: 'text', text: message }],
            context: {},
          }));
        });

        ws.on('message', (chunk) => {
          try {
            const parsed = JSON.parse(chunk.toString());

            switch (parsed.event) {
              case 'appendText':
                reply += parsed.text || '';
                break;

              case 'citation':
                citations.push({
                  title: parsed.title,
                  icon: parsed.iconUrl,
                  url: parsed.url,
                });
                break;

              case 'done':
                resolve({
                  success: true,
                  reply: reply.trim() || 'Désolé, je n\'ai pas pu répondre.',
                  citations,
                });
                ws.close();
                break;

              case 'error':
                reject(new Error(parsed.message));
                ws.close();
                break;
            }
          } catch (err) {
            // Ignorer les erreurs de parsing
          }
        });

        ws.on('error', (err) => {
          reject(new Error(err.message));
        });

        setTimeout(() => {
          ws.close();
          resolve({
            success: true,
            reply: reply.trim() || '⚠️ La réponse a pris trop de temps. Réessaie !',
          });
        }, 30000);
      });

      return response;

    } catch (error) {
      console.error('Copilot error:', error.message);

      return {
        success: true,
        reply: `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Désolé, je rencontre un problème technique. Réessaie dans un instant !\n\n— XELIRA ✦`,
      };
    }
  }
}
