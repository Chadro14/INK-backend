import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  private readonly geminiKey: string;
  private readonly groqKeys: string[];
  private currentGroqIndex: number = 0;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    
    // ✅ Récupérer toutes les clés Groq
    const keys = process.env.GROQ_API_KEYS || '';
    this.groqKeys = keys.split(',').filter(k => k.trim());
    
    // Si une seule clé est définie, on la met dans le tableau
    if (this.groqKeys.length === 0 && process.env.GROQ_API_KEY) {
      this.groqKeys.push(process.env.GROQ_API_KEY);
    }
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
          return { success: true, reply: this.cleanReply(reply) };
        }
      } catch (error) {
        console.error('Gemini error:', error.message);
      }
    }

    // 2. TENTATIVE GROQ AVEC ROTATION DES CLÉS
    if (this.groqKeys.length > 0) {
      for (let i = 0; i < this.groqKeys.length; i++) {
        const index = (this.currentGroqIndex + i) % this.groqKeys.length;
        const key = this.groqKeys[index];
        
        try {
          reply = await this.callGroq(key, prompt, message, history);
          if (reply) {
            console.log(`✅ Réponse Groq (clé ${index + 1}/${this.groqKeys.length})`);
            this.currentGroqIndex = (index + 1) % this.groqKeys.length; // Rotation
            return { success: true, reply: this.cleanReply(reply) };
          }
        } catch (error) {
          console.error(`Groq error (clé ${index + 1}):`, error.message);
        }
      }
    }

    // 3. RÉPONSE PAR DÉFAUT
    const defaultReply = `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, ton assistante. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`;
    return { success: true, reply: defaultReply };
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
  // APPEL GROQ
  // ============================================
  private async callGroq(
    apiKey: string,
    systemPrompt: string,
    message: string,
    history: any[],
  ): Promise<string | null> {
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
        Authorization: `Bearer ${apiKey}`,
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
