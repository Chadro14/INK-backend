// src/modules/ai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

export interface OpenAICallOptions {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openaiKeys: string[];
  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly defaultModel = 'gpt-4o-mini';

  constructor(private configService: ConfigService) {
    this.openaiKeys = this.loadKeys();

    if (this.openaiKeys.length === 0) {
      this.logger.warn(
        '⚠️ Aucune clé ChatGPT configurée. OZYRA ne pourra pas utiliser ChatGPT.',
      );
    } else {
      this.logger.log(
        `✅ ${this.openaiKeys.length} clé(s) ChatGPT chargée(s).`,
      );
    }
  }

  /**
   * Charge les clés depuis Vercel :
   * - `chatgpt`  → clé 1
   * - `chatgpt2` → clé 2
   *
   * Note : ces noms sont exactement ceux configurés dans Vercel.
   */
  private loadKeys(): string[] {
    const keys: string[] = [];

    const k1 = this.configService.get<string>('chatgpt');
    if (k1 && k1.trim().length > 0) keys.push(k1.trim());

    const k2 = this.configService.get<string>('chatgpt2');
    if (k2 && k2.trim().length > 0) keys.push(k2.trim());

    // Support optionnel : CHATGPT_API_KEY_1..N (si tu renommes plus tard)
    for (let i = 1; i <= 20; i++) {
      const key = this.configService.get<string>(`CHATGPT_API_KEY_${i}`);
      if (key && key.trim().length > 0 && !keys.includes(key.trim())) {
        keys.push(key.trim());
      }
    }

    return keys;
  }

  isAvailable(): boolean {
    return this.openaiKeys.length > 0;
  }

  /**
   * Appel principal à ChatGPT avec rotation automatique des clés.
   */
  async call(options: OpenAICallOptions): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OPENAI_NO_KEYS');
    }

    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 800,
      tools,
      toolChoice,
      responseFormat,
    } = options;

    const body: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = toolChoice || 'auto';
    }

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    let lastError: any = null;

    for (let attempt = 0; attempt < this.openaiKeys.length; attempt++) {
      const keyIndex =
        (this.currentKeyIndex + attempt) % this.openaiKeys.length;
      const key = this.openaiKeys[keyIndex];

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          this.logger.warn(
            `ChatGPT clé #${keyIndex + 1} a échoué (status ${response.status}).`,
          );
          lastError = errorData;
          continue;
        }

        const data = await response.json();

        // Si tools sont utilisés, on renvoie le message complet (JSON string)
        if (tools && tools.length > 0) {
          return JSON.stringify(data.choices?.[0]?.message || {});
        }

        const content = data.choices?.[0]?.message?.content;
        if (content) {
          this.currentKeyIndex = keyIndex;
          return content;
        }

        lastError = new Error('Réponse ChatGPT vide');
      } catch (error) {
        this.logger.warn(
          `ChatGPT clé #${keyIndex + 1} a échoué (exception): ${error.message}`,
        );
        lastError = error;
      }
    }

    this.logger.error(
      `❌ Toutes les clés ChatGPT ont échoué. Dernière erreur : ${lastError?.message || 'inconnue'}`,
    );
    throw new Error('OPENAI_ALL_KEYS_FAILED');
  }

  /**
   * Appel simplifié : un seul message utilisateur.
   */
  async ask(
    prompt: string,
    options: Partial<OpenAICallOptions> = {},
  ): Promise<string> {
    return this.call({
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });
  }
}
