// src/modules/ai/gemini.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiCallOptions {
  messages: GeminiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  responseMimeType?: 'text/plain' | 'application/json';
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly geminiKeys: string[];
  private currentKeyIndex = 0;
  private readonly baseUrl =
    'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly defaultModel = 'gemini-1.5-flash';

  constructor(private configService: ConfigService) {
    this.geminiKeys = this.loadKeys();

    if (this.geminiKeys.length === 0) {
      this.logger.warn(
        '⚠️ Aucune clé Gemini configurée. OZYRA ne pourra pas utiliser Gemini.',
      );
    } else {
      this.logger.log(`✅ ${this.geminiKeys.length} clé(s) Gemini chargée(s).`);
    }
  }

  /**
   * Charge dynamiquement GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
   */
  private loadKeys(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const key = this.configService.get<string>(`GEMINI_API_KEY_${i}`);
      if (key && key.trim().length > 0) {
        keys.push(key.trim());
      }
    }
    return keys;
  }

  isAvailable(): boolean {
    return this.geminiKeys.length > 0;
  }

  /**
   * Appel principal à Gemini avec rotation automatique des clés.
   */
  async call(options: GeminiCallOptions): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('GEMINI_NO_KEYS');
    }

    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 800,
      systemInstruction,
      responseMimeType,
    } = options;

    const body: any = {
      contents: messages,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (responseMimeType) {
      body.generationConfig.responseMimeType = responseMimeType;
    }

    let lastError: any = null;

    for (let attempt = 0; attempt < this.geminiKeys.length; attempt++) {
      const keyIndex = (this.currentKeyIndex + attempt) % this.geminiKeys.length;
      const key = this.geminiKeys[keyIndex];

      try {
        const url = `${this.baseUrl}/${model}:generateContent?key=${key}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          this.logger.warn(
            `Gemini clé #${keyIndex + 1} a échoué (status ${response.status}).`,
          );
          lastError = errorData;
          continue;
        }

        const data = await response.json();

        const content =
          data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (content) {
          this.currentKeyIndex = keyIndex;
          return content;
        }

        lastError = new Error('Réponse Gemini vide');
      } catch (error) {
        this.logger.warn(
          `Gemini clé #${keyIndex + 1} a échoué (exception): ${error.message}`,
        );
        lastError = error;
      }
    }

    this.logger.error(
      `❌ Toutes les clés Gemini ont échoué. Dernière erreur : ${lastError?.message || 'inconnue'}`,
    );
    throw new Error('GEMINI_ALL_KEYS_FAILED');
  }

  /**
   * Appel simplifié : un seul prompt utilisateur, avec instruction système optionnelle.
   */
  async ask(
    prompt: string,
    systemInstruction?: string,
    options: Partial<GeminiCallOptions> = {},
  ): Promise<string> {
    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: prompt }] },
    ];

    return this.call({
      messages,
      systemInstruction,
      ...options,
    });
  }

  /**
   * Version conversation : prend un historique + message courant.
   * Convertit le format OpenAI-style (user/assistant) en Gemini-style (user/model).
   */
  async chat(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    message: string,
    systemInstruction?: string,
    options: Partial<GeminiCallOptions> = {},
  ): Promise<string> {
    const messages: GeminiMessage[] = [];

    for (const msg of history.slice(-10)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    messages.push({ role: 'user', parts: [{ text: message }] });

    return this.call({
      messages,
      systemInstruction,
      ...options,
    });
  }
}
