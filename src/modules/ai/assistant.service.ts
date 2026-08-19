// src/modules/ai/assistant.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AssistantService {
  private readonly groqKeys: string[] = [
    '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',
    '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',
    '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',
    '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',
  ];

  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  // ============================================
  // SUGGÉRER DES IDÉES
  // ============================================
  async suggestIdeas(
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

    return this.callGroq(prompt);
  }

  // ============================================
  // AIDE AU DIALOGUE
  // ============================================
  async suggestDialogue(
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

    return this.callGroq(prompt);
  }

  // ============================================
  // DÉCRIRE UNE SCÈNE
  // ============================================
  async describeScene(
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

    return this.callGroq(prompt);
  }

  // ============================================
  // RÉÉCRITURE
  // ============================================
  async rewriteText(
    text: string,
    style: 'plus dynamique' | 'plus poétique' | 'plus simple' | 'plus sérieux',
  ): Promise<string> {
    const prompt = `Tu es l'assistant d'écriture de INKDROP.

Texte original : "${text}"

Réécris ce texte dans un style ${style}. Garde le même sens mais change la forme.

Réécriture :`;

    return this.callGroq(prompt);
  }

  // ============================================
  // APPEL GROQ
  // ============================================
  private async callGroq(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return reply;
        }
      } catch (error) {
        continue;
      }
    }

    return 'Je n\'ai pas pu générer de suggestions. Veuillez réessayer.';
  }
}