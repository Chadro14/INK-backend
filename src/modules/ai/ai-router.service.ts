// src/modules/ai/ai-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GroqService, GroqCallOptions } from './groq.service';
import { GeminiService, GeminiCallOptions } from './gemini.service';
import { OpenAIService, OpenAICallOptions } from './openai.service';

export type AiProvider = 'groq' | 'gemini' | 'openai';

export interface AiRouterOptions {
  // Format unifié : messages au format OpenAI (user/assistant/system)
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  // Function calling (uniquement Groq + OpenAI pour l'instant)
  tools?: any[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
  // Forcer un fournisseur (optionnel)
  forceProvider?: AiProvider;
  // Préférer OpenAI (utile pour Premium)
  preferPremium?: boolean;
}

export interface AiRouterResult {
  content: string;
  provider: AiProvider;
  model: string;
  attempts: Array<{ provider: AiProvider; success: boolean; error?: string }>;
}

@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);

  constructor(
    private groqService: GroqService,
    private geminiService: GeminiService,
    private openaiService: OpenAIService,
  ) {}

  /**
   * Point d'entrée principal.
   * Essaie les fournisseurs dans l'ordre : Groq → Gemini → OpenAI.
   * Retourne la première réponse qui marche.
   */
  async call(options: AiRouterOptions): Promise<AiRouterResult> {
    const attempts: Array<{
      provider: AiProvider;
      success: boolean;
      error?: string;
    }> = [];

    // Déterminer l'ordre des fournisseurs
    const order = this.getProviderOrder(options);

    for (const provider of order) {
      try {
        const content = await this.callProvider(provider, options);

        attempts.push({ provider, success: true });

        const model = this.getModelName(provider);

        this.logger.log(
          `✅ Réponse obtenue via ${provider} (${model}). Tentatives : ${attempts.length}`,
        );

        return { content, provider, model, attempts };
      } catch (error) {
        attempts.push({
          provider,
          success: false,
          error: error.message,
        });

        this.logger.warn(
          `⚠️ ${provider} a échoué : ${error.message}. Passage au suivant.`,
        );
      }
    }

    // Tous les fournisseurs ont échoué
    this.logger.error(
      `❌ Tous les fournisseurs IA ont échoué. Tentatives : ${JSON.stringify(attempts)}`,
    );
    throw new Error('ALL_AI_PROVIDERS_FAILED');
  }

  /**
   * Détermine l'ordre des fournisseurs selon les options.
   * Par défaut : Groq → Gemini → OpenAI.
   */
  private getProviderOrder(options: AiRouterOptions): AiProvider[] {
    // Si on force un fournisseur
    if (options.forceProvider) {
      return [options.forceProvider];
    }

    // Si Premium : OpenAI en priorité
    if (options.preferPremium && this.openaiService.isAvailable()) {
      return ['openai', 'groq', 'gemini'].filter((p) => this.isAvailable(p as AiProvider)) as AiProvider[];
    }

    // Par défaut : Groq → Gemini → OpenAI
    return ['groq', 'gemini', 'openai'].filter((p) =>
      this.isAvailable(p as AiProvider),
    ) as AiProvider[];
  }

  /**
   * Vérifie si un fournisseur est disponible (clés configurées).
   */
  private isAvailable(provider: AiProvider): boolean {
    switch (provider) {
      case 'groq':
        return this.groqService.isAvailable();
      case 'gemini':
        return this.geminiService.isAvailable();
      case 'openai':
        return this.openaiService.isAvailable();
      default:
        return false;
    }
  }

  /**
   * Appelle un fournisseur spécifique.
   * Le format des messages est unifié en OpenAI-style, puis converti pour Gemini si besoin.
   */
  private async callProvider(
    provider: AiProvider,
    options: AiRouterOptions,
  ): Promise<string> {
    const {
      messages,
      systemInstruction,
      temperature = 0.7,
      maxTokens = 800,
      tools,
      toolChoice,
      responseFormat,
    } = options;

    switch (provider) {
      case 'groq': {
        const groqOptions: GroqCallOptions = {
          messages: this.buildGroqMessages(messages, systemInstruction),
          temperature,
          maxTokens,
          tools,
          toolChoice,
          responseFormat,
        };
        return this.groqService.call(groqOptions);
      }

      case 'gemini': {
        // Gemini ne supporte pas le function calling dans notre implémentation,
        // donc si tools sont demandés, on ignore Gemini dans le fallback.
        if (tools && tools.length > 0) {
          throw new Error('GEMINI_TOOLS_NOT_SUPPORTED');
        }

        const geminiOptions: GeminiCallOptions = {
          messages: this.buildGeminiMessages(messages),
          systemInstruction,
          temperature,
          maxTokens,
          responseMimeType:
            responseFormat?.type === 'json_object' ? 'application/json' : undefined,
        };
        return this.geminiService.call(geminiOptions);
      }

      case 'openai': {
        const openaiOptions: OpenAICallOptions = {
          messages: this.buildOpenAIMessages(messages, systemInstruction),
          temperature,
          maxTokens,
          tools,
          toolChoice,
          responseFormat,
        };
        return this.openaiService.call(openaiOptions);
      }

      default:
        throw new Error(`Fournisseur inconnu : ${provider}`);
    }
  }

  /**
   * Construit les messages au format Groq (OpenAI-compatible) avec system instruction.
   */
  private buildGroqMessages(
    messages: AiRouterOptions['messages'],
    systemInstruction?: string,
  ): GroqCallOptions['messages'] {
    const result: GroqCallOptions['messages'] = [];

    if (systemInstruction) {
      result.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content });
    }

    return result;
  }

  /**
   * Construit les messages au format OpenAI avec system instruction.
   */
  private buildOpenAIMessages(
    messages: AiRouterOptions['messages'],
    systemInstruction?: string,
  ): OpenAICallOptions['messages'] {
    const result: OpenAICallOptions['messages'] = [];

    if (systemInstruction) {
      result.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content });
    }

    return result;
  }

  /**
   * Convertit les messages OpenAI-style en Gemini-style (user/model).
   * Gemini ne supporte pas le rôle "system" dans les messages ; il faut le passer à part.
   */
  private buildGeminiMessages(
    messages: AiRouterOptions['messages'],
  ): GeminiCallOptions['messages'] {
    const result: GeminiCallOptions['messages'] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // géré via systemInstruction
      result.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    return result;
  }

  /**
   * Renvoie le nom du modèle utilisé par fournisseur.
   */
  private getModelName(provider: AiProvider): string {
    switch (provider) {
      case 'groq':
        return 'llama-3.3-70b-versatile';
      case 'gemini':
        return 'gemini-1.5-flash';
      case 'openai':
        return 'gpt-4o-mini';
      default:
        return 'unknown';
    }
  }

  /**
   * Méthode simplifiée : un seul prompt.
   */
  async ask(
    prompt: string,
    systemInstruction?: string,
    options: Partial<AiRouterOptions> = {},
  ): Promise<AiRouterResult> {
    return this.call({
      messages: [{ role: 'user', content: prompt }],
      systemInstruction,
      ...options,
    });
  }
}
