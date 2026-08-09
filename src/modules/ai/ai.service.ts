import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly apiKeys: string[] = [
    'AQ.Ab8RN6LjsLBz-7SPBsOVg-9BNw-LtmLoNqAVgNQYfKsVxLTpdw',
    'AQ.Ab8RN6JfVpOnX77i8dXc7E3tBNMcY6IYSVsKsgl_CCLj3Pob-g',
    'AQ.Ab8RN6KPPnWmRvH3RfzOr6b6D7b-9AQeWY7Xc7uB-M0uEha8Iw',
  ];
  private currentKeyIndex = 0;

  private readonly apiUrl = 'https://gemini-1-5-flash.bjcoderx.workers.dev/';

  // ============================================
  // CHAT AVEC ROTATION DES CLÉS
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

    // Construire le prompt complet
    const prompt = this.buildPrompt(message, history, firstName, systemPrompt);

    // Essayer chaque clé jusqu'à obtenir une réponse
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const key = this.apiKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

      try {
        const url = `${this.apiUrl}?text=${encodeURIComponent(prompt)}&key=${key}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          console.log(`❌ Clé ${attempt + 1} échouée (${response.status})`);
          continue;
        }

        const data = await response.json();
        
        // Extraction de la réponse (différents formats possibles)
        const reply = data.reply || data.response || data.text || data.result;
        
        if (reply) {
          console.log(`✅ Réponse avec clé ${attempt + 1}`);
          return { success: true, reply: this.cleanReply(reply) };
        }
      } catch (error) {
        console.error(`❌ Erreur clé ${attempt + 1}:`, error.message);
      }
    }

    // Réponse par défaut si tout échoue
    return {
      success: true,
      reply: `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Désolé, je rencontre un problème technique. Réessaie dans un instant !\n\n— XELIRA ✦`
    };
  }

  // ============================================
  // CONSTRUCTION DU PROMPT
  // ============================================
  private buildPrompt(
    message: string,
    history: any[],
    firstName: string,
    systemPrompt?: string,
  ): string {
    let prompt = systemPrompt || this.getSystemPrompt(firstName);

    if (history && history.length > 0) {
      const recentHistory = history.slice(-5);
      const context = recentHistory
        .map((m) => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content}`)
        .join('\n');
      prompt += `\n\n📚 Conversation récente :\n${context}`;
    }

    prompt += `\n\n👤 ${firstName || 'Utilisateur'} : ${message}`;
    return prompt;
  }

  // ============================================
  // NETTOYAGE DES RÉPONSES
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
