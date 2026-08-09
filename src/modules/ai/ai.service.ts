import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly geminiKey: string;
  private readonly groqKey: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    this.groqKey = process.env.GROQ_API_KEY || '';
  }

  // ============================================
  // CHAT AVEC IA (Gemini + Groq en fallback)
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

    const prompt = systemPrompt || this.getSystemPrompt(firstName);

    let reply: string | null = null;

    // 1. TENTATIVE GEMINI
    if (this.geminiKey) {
      try {
        reply = await this.callGemini(prompt, message, history);
        if (reply) {
          console.log('✅ Réponse Gemini');
        }
      } catch (error) {
        console.error('Gemini error:', error.message);
      }
    }

    // 2. FALLBACK GROQ
    if (!reply && this.groqKey) {
      try {
        reply = await this.callGroq(prompt, message, history);
        if (reply) {
          console.log('✅ Réponse Groq');
        }
      } catch (error) {
        console.error('Groq error:', error.message);
      }
    }

    // 3. RÉPONSE PAR DÉFAUT
    if (!reply) {
      reply = `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`;
    }

    // Nettoyer la réponse
    const cleanReply = reply
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '')
      .trim();

    return { success: true, reply: cleanReply };
  }

  // ============================================
  // APPEL GEMINI
  // ============================================
  private async callGemini(
    systemPrompt: string,
    message: string,
    history: any[],
  ): Promise<string | null> {
    if (!this.geminiKey) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`;

    const parts = [{ text: systemPrompt }];

    if (history && history.length > 0) {
      const recentHistory = history.slice(-10);
      const context = recentHistory
        .map((m) => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content}`)
        .join('\n');
      parts.push({ text: `📚 Conversation :\n${context}` });
    }

    parts.push({ text: `Message : ${message}` });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  // ============================================
  // APPEL GROQ (fallback)
  // ============================================
  private async callGroq(
    systemPrompt: string,
    message: string,
    history: any[],
  ): Promise<string | null> {
    if (!this.groqKey) return null;

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
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
