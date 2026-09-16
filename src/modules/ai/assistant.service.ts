// src/modules/ai/assistant.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AiRouterService } from './ai-router.service';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private aiRouter: AiRouterService) {}

  // ============================================
  // SUGGÉRER DES IDÉES
  // ============================================
  async suggestIdeas(
    context: string,
    characters: string[],
    genre: string,
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'écriture d'INKDROP. Tu aides les créateurs de mangas avec des idées créatives.`;

    const prompt = `Contexte actuel : ${context || 'Non spécifié'}
Personnages : ${characters.join(', ') || 'Aucun'}
Genre : ${genre || 'Non spécifié'}

Propose 3 idées pour la suite de l'histoire. Chaque idée doit être courte (1-2 phrases) et accrocheuse.`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.8,
        maxTokens: 500,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(`Suggestion d'idées échouée : ${error.message}`);
      return "Je n'ai pas pu générer de suggestions. Veuillez réessayer.";
    }
  }

  // ============================================
  // AIDE AU DIALOGUE
  // ============================================
  async suggestDialogue(
    character1: string,
    character2: string,
    situation: string,
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'écriture d'INKDROP. Tu écris des dialogues naturels pour des mangas.`;

    const prompt = `Personnage 1 : ${character1}
Personnage 2 : ${character2}
Situation : ${situation}

Propose un dialogue naturel entre ces deux personnages dans ce contexte. Le dialogue doit être court (4-6 répliques).`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.8,
        maxTokens: 500,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(`Suggestion de dialogue échouée : ${error.message}`);
      return "Je n'ai pas pu générer de dialogue. Veuillez réessayer.";
    }
  }

  // ============================================
  // DÉCRIRE UNE SCÈNE
  // ============================================
  async describeScene(
    sceneType: string,
    mood: string,
    elements: string[],
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'écriture d'INKDROP. Tu décris des scènes de mangas de manière immersive.`;

    const prompt = `Type de scène : ${sceneType}
Ambiance : ${mood}
Éléments présents : ${elements.join(', ') || 'Aucun'}

Rédige une description courte et immersive de cette scène (2-3 phrases).`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.8,
        maxTokens: 400,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(`Description de scène échouée : ${error.message}`);
      return "Je n'ai pas pu générer de description. Veuillez réessayer.";
    }
  }

  // ============================================
  // RÉÉCRITURE
  // ============================================
  async rewriteText(
    text: string,
    style: 'plus dynamique' | 'plus poétique' | 'plus simple' | 'plus sérieux',
  ): Promise<string> {
    const systemInstruction = `Tu es OZYRA, l'assistante d'écriture d'INKDROP. Tu réécris des textes en changeant le style sans changer le sens.`;

    const prompt = `Texte original : "${text}"

Réécris ce texte dans un style ${style}. Garde le même sens mais change la forme.`;

    try {
      const result = await this.aiRouter.ask(prompt, systemInstruction, {
        temperature: 0.7,
        maxTokens: 500,
      });

      return result.content;
    } catch (error) {
      this.logger.warn(`Réécriture échouée : ${error.message}`);
      return "Je n'ai pas pu réécrire ce texte. Veuillez réessayer.";
    }
  }
}
