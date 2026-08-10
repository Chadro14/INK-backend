import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  // ✅ TOUTES LES CLÉS GROQ
  private readonly groqKeys: string[] = [
    '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',
    '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',
    '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',
    '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',
  ];
  
  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  // ============================================
  // CHAT AVEC GROQ (rotation des clés)
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

    if (this.groqKeys.length === 0) {
      return {
        success: true,
        reply: `⚠️ Aucune clé Groq disponible. Contacte l'administrateur. — XELIRA ✦`,
      };
    }

    const systemPrompt = this.getSystemPrompt(firstName);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Essayer chaque clé jusqu'à obtenir une réponse
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        console.log(`🔄 Tentative avec clé ${attempt + 1}/${this.groqKeys.length}`);

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
            max_tokens: 1000,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.log(`❌ Clé ${attempt + 1} échouée:`, data.error?.message || response.status);
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        
        if (reply) {
          console.log(`✅ Réponse avec clé ${attempt + 1}`);
          return { success: true, reply: this.cleanReply(reply) };
        }

      } catch (error) {
        console.error(`❌ Erreur clé ${attempt + 1}:`, error.message);
      }
    }

    // Si toutes les clés échouent
    return {
      success: true,
      reply: `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Désolé, toutes mes connexions sont occupées. Réessaie dans un instant !\n\n— XELIRA ✦`,
    };
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