import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly apiUrl = 'https://gpt-3-5.apis-bj-devs.workers.dev/';

  // ============================================
  // CHAT AVEC L'API SIMPLE
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
    systemPrompt?: string,
  ) {
    if (!message) {
      throw new BadRequestException('Message requis');
    }

    try {
      // 1. Construire le prompt avec le contexte
      let fullPrompt = systemPrompt || this.getSystemPrompt(firstName);
      
      // Ajouter l'historique récent
      if (history && history.length > 0) {
        const recentHistory = history.slice(-5);
        const context = recentHistory
          .map((m) => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content}`)
          .join('\n');
        fullPrompt += `\n\n📚 Conversation récente :\n${context}`;
      }
      
      fullPrompt += `\n\n👤 ${firstName || 'Utilisateur'} : ${message}`;

      // 2. Appel à l'API
      const url = `${this.apiUrl}?prompt=${encodeURIComponent(fullPrompt)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status && data.reply) {
        // Nettoyer la réponse
        const cleanReply = data.reply
          .replace(/\{[\s\S]*?\}/g, '')
          .replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '')
          .trim();
          
        return { success: true, reply: cleanReply };
      } else {
        throw new Error('Réponse invalide de l\'API');
      }

    } catch (error) {
      console.error('Erreur API:', error.message);
      
      // Réponse par défaut
      return {
        success: true,
        reply: `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Désolé, je rencontre un problème technique. Réessaie dans un instant !\n\n— XELIRA ✦`
      };
    }
  }

  // ============================================
  // PROMPT SYSTÈME
  // ============================================
  private getSystemPrompt(firstName: string): string {
    const name = firstName || 'Cher utilisateur';

    return `Tu es XELIRA, l'assistante IA de INKDROP.

L'utilisateur s'appelle "${name}". Utilise son prénom régulièrement.

RÈGLES :
- Sois chaleureux, amical et utile 😊
- Utilise 1 à 3 émojis par message
- Réponds TOUJOURS en français
- Pour le code : donne du code commenté en français
- Pour les explications : sois simple et clair
- Termine chaque réponse par "— XELIRA ✦"`;
  }
}
