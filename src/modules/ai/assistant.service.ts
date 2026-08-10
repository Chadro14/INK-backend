import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';

@Injectable()
export class AssistantService {
  constructor(private aiService: AiService) {}

  // ============================================
  // SUGGÉRER DES IDÉES
  // ============================================
  async suggestIdeas(
    userId: string,
    context: string,
    characters: string[],
    genre: string,
  ): Promise<string> {
    const prompt = `Tu es l'assistant d'écriture de INKDROP.

Contexte actuel : ${context}
Personnages : ${characters.join(', ') || 'Aucun'}
Genre : ${genre || 'Non spécifié'}

Propose 3 idées pour la suite de l'histoire. Chaque idée doit être courte (1-2 phrases) et accrocheuse.

Idées proposées :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }

  // ============================================
  // AIDE AU DIALOGUE
  // ============================================
  async suggestDialogue(
    userId: string,
    character1: string,
    character2: string,
    situation: string,
  ): Promise<string> {
    const prompt = `Tu es l'assistant d'écriture de INKDROP.

Personnage 1 : ${character1}
Personnage 2 : ${character2}
Situation : ${situation}

Propose un dialogue naturel entre ces deux personnages dans ce contexte. Le dialogue doit être court (4-6 répliques).

Dialogue :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }

  // ============================================
  // DÉCRIRE UNE SCÈNE
  // ============================================
  async describeScene(
    userId: string,
    sceneType: string,
    mood: string,
    elements: string[],
  ): Promise<string> {
    const prompt = `Tu es l'assistant d'écriture de INKDROP.

Type de scène : ${sceneType}
Ambiance : ${mood}
Éléments présents : ${elements.join(', ') || 'Aucun'}

Rédige une description courte et immersive de cette scène (2-3 phrases).

Description :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }

  // ============================================
  // RÉÉCRITURE
  // ============================================
  async rewriteText(
    userId: string,
    text: string,
    style: 'plus dynamique' | 'plus poétique' | 'plus simple' | 'plus sérieux',
  ): Promise<string> {
    const prompt = `Tu es l'assistant d'écriture de INKDROP.

Texte original : "${text}"

Réécris ce texte dans un style ${style}. Garde le même sens mais change la forme.

Réécriture :`;

    const result = await this.aiService.chat(userId, prompt, [], 'Système');
    return result.reply;
  }
}