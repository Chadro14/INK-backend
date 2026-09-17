// src/modules/ai/ai-router.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GroqService, GroqCallOptions } from './groq.service';
import { GeminiService, GeminiCallOptions } from './gemini.service';
import { OpenAIService, OpenAICallOptions } from './openai.service';

export type AiProvider = 'groq' | 'gemini' | 'openai';

// ✅ NOUVEAU — Support du rôle "tool" pour le function calling
export interface AiRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

export interface AiRouterOptions {
  messages: AiRouterMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
  forceProvider?: AiProvider;
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

  async call(options: AiRouterOptions): Promise<AiRouterResult> {
    const attempts: Array<{
      provider: AiProvider;
      success: boolean;
      error?: string;
    }> = [];

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

    this.logger.error(
      `❌ Tous les fournisseurs IA ont échoué. Tentatives : ${JSON.stringify(attempts)}`,
    );
    throw new Error('ALL_AI_PROVIDERS_FAILED');
  }

  private getProviderOrder(options: AiRouterOptions): AiProvider[] {
    if (options.forceProvider) {
      return [options.forceProvider];
    }

    if (options.preferPremium && this.openaiService.isAvailable()) {
      return ['openai', 'groq', 'gemini'].filter((p) =>
        this.isAvailable(p as AiProvider),
      ) as AiProvider[];
    }

    return ['groq', 'gemini', 'openai'].filter((p) =>
      this.isAvailable(p as AiProvider),
    ) as AiProvider[];
  }

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
        // Gemini ne supporte pas le function calling ni le rôle "tool"
        if (tools && tools.length > 0) {
          throw new Error('GEMINI_TOOLS_NOT_SUPPORTED');
        }

        const geminiOptions: GeminiCallOptions = {
          messages: this.buildGeminiMessages(messages),
          systemInstruction,
          temperature,
          maxTokens,
          responseMimeType:
            responseFormat?.type === 'json_object'
              ? 'application/json'
              : undefined,
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
   * ✅ CORRIGÉ — préserve tool_call_id + tool_calls + name
   */
  private buildGroqMessages(
    messages: AiRouterMessage[],
    systemInstruction?: string,
  ): GroqCallOptions['messages'] {
    const result: GroqCallOptions['messages'] = [];

    if (systemInstruction) {
      result.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      const m: any = { role: msg.role, content: msg.content };
      if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
      if (msg.tool_calls) m.tool_calls = msg.tool_calls;
      if (msg.name) m.name = msg.name;
      result.push(m);
    }

    return result;
  }

  /**
   * ✅ CORRIGÉ — préserve tool_call_id + tool_calls + name
   */
  private buildOpenAIMessages(
    messages: AiRouterMessage[],
    systemInstruction?: string,
  ): OpenAICallOptions['messages'] {
    const result: OpenAICallOptions['messages'] = [];

    if (systemInstruction) {
      result.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      const m: any = { role: msg.role, content: msg.content };
      if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
      if (msg.tool_calls) m.tool_calls = msg.tool_calls;
      if (msg.name) m.name = msg.name;
      result.push(m);
    }

    return result;
  }

  /**
   * ✅ CORRIGÉ — ignore "system" ET "tool" (non supportés par Gemini)
   */
  private buildGeminiMessages(
    messages: AiRouterMessage[],
  ): GeminiCallOptions['messages'] {
    const result: GeminiCallOptions['messages'] = [];

    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'tool') continue;
      result.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    return result;
  }

  private getModelName(provider: AiProvider): string {
    switch (provider) {
      case 'groq':
        return 'openai/gpt-oss-120b';
      case 'gemini':
        return 'gemini-1.5-flash';
      case 'openai':
        return 'gpt-4o-mini';
      default:
        return 'unknown';
    }
  }

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
