// src/modules/ai/groq.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

export interface GroqCallOptions {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[]; // Pour le function calling
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly groqKeys: string[];
  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly defaultModel = 'llama-3.3-70b-versatile';

  constructor(private configService: ConfigService) {
    // Charge les clés GROQ_API_KEY_1 à GROQ_API_KEY_N dynamiquement
    this.groqKeys = this.loadKeys();

    if (this.groqKeys.length === 0) {
      this.logger.warn(
        '⚠️ Aucune clé Groq configurée. OZYRA ne pourra pas utiliser Groq.',
      );
    } else {
      this.logger.log(`✅ ${this.groqKeys.length} clé(s) Groq chargée(s).`);
    }
  }

  /**
   * Charge dynamiquement les clés GROQ_API_KEY_1, GROQ_API_KEY_2, ...
   * jusqu'à ce qu'il n'y en ait plus.
   */
  private loadKeys(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const key = this.configService.get<string>(`GROQ_API_KEY_${i}`);
      if (key && key.trim().length > 0) {
        keys.push(key.trim());
      }
    }
    return keys;
  }

  /**
   * Vérifie si le service est disponible (au moins une clé).
   */
  isAvailable(): boolean {
    return this.groqKeys.length > 0;
  }

  /**
   * Appel principal à Groq avec rotation automatique des clés.
   * Essaie chaque clé jusqu'à en trouver une qui fonctionne.
   */
  async call(options: GroqCallOptions): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('GROQ_NO_KEYS');
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

    // Rotation : on essaie chaque clé dans l'ordre
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const keyIndex = (this.currentKeyIndex + attempt) % this.groqKeys.length;
      const key = this.groqKeys[keyIndex];

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
            `Groq clé #${keyIndex + 1} a échoué (status ${response.status}).`,
          );
          lastError = errorData;
          continue;
        }

        const data = await response.json();

        // Si tools sont utilisés, on renvoie le message complet
        if (tools && tools.length > 0) {
          return JSON.stringify(data.choices?.[0]?.message || {});
        }

        const content = data.choices?.[0]?.message?.content;
        if (content) {
          // Succès : on mémorise cette clé comme la prochaine à utiliser
          this.currentKeyIndex = keyIndex;
          return content;
        }

        lastError = new Error('Réponse Groq vide');
      } catch (error) {
        this.logger.warn(
          `Groq clé #${keyIndex + 1} a échoué (exception): ${error.message}`,
        );
        lastError = error;
      }
    }

    this.logger.error(
      `❌ Toutes les clés Groq ont échoué. Dernière erreur : ${lastError?.message || 'inconnue'}`,
    );
    throw new Error('GROQ_ALL_KEYS_FAILED');
  }

  /**
   * Appel simplifié : un seul message utilisateur.
   */
  async ask(prompt: string, options: Partial<GroqCallOptions> = {}): Promise<string> {
    return this.call({
      messages: [{ role: 'user', content: prompt }],
      ...options,
    });
  }
}
