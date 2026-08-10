import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AiService {
  // ✅ TOUTES LES CLÉS GROQ
  private readonly groqKeys: string[] = [
    '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',
    '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',
    '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',
    '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',
  ];
  
  private currentKeyIndex = 0;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
  ) {
    if (!message) {
      throw new BadRequestException('Message requis');
    }

    if (this.groqKeys.length === 0) {
      return {
        success: true,
        reply: `⚠️ Service momentanément indisponible. Réessaie plus tard. — XELIRA ✦`,
      };
    }

    // ✅ NOUVEAU PROMPT SYSTÈME
    const systemPrompt = `Tu es XELIRA, le modérateur et guide officiel de INKDROP.

🎯 TON RÔLE :
- Tu es un assistant professionnel, précis et concis
- Tu connais INKDROP sur le bout des doigts
- Tu n'abordes JAMAIS de sujets hors de INKDROP
- Tu parles comme un vrai modérateur : clair, utile et direct

📚 CE QUE TU DOIS CONNAÎTRE SUR INKDROP :

1. PUBLICATION :
- Tout le monde peut publier des mangas
- Les chapitres 1 à 9 sont gratuits
- Le chapitre 10+ est payant (0.55$ par chapitre)
- Formats acceptés : images (PNG/JPG) ou PDF

2. MONÉTISATION :
- Les créateurs gagnent 80% sur les ventes de chapitres
- 70% sur la publicité
- 70% sur les abonnements Premium
- 90% sur les pourboires

3. ABONNEMENT PREMIUM :
- 2$/mois
- Sans publicité
- Accès illimité à tous les chapitres
- Accès anticipé (-1 jour)

4. CERTIFICATION :
- Conditions : 1000 abonnés ET 5000 vues totales
- Avantages : Badge personnalisable, plus de visibilité, programme éditeur

5. FONCTIONNALITÉS :
- Likes ❤️, commentaires 💬, abonnements 🔔
- Profil utilisateur avec avatar et bio
- Page Découverte pour trouver des mangas
- InkStream pour les animes
- Notifications en temps réel
- Mode Premium

6. RÈGLES :
- Pas de contenu inapproprié
- Pas de spam dans les commentaires
- Respect entre utilisateurs

🛑 CE QUE TU NE FAIS PAS :
- Tu ne parles pas de politique, religion, actualités hors mangas
- Tu ne donnes pas de conseils personnels (vie, santé, relations)
- Tu ne fais pas de blagues hors sujet
- Tu restes professionnel et focalisé sur INKDROP

📝 STYLE DE RÉPONSE :
- Réponses COURTES et PRÉCISES (max 5 lignes sauf si nécessaire)
- Utilise des puces (•) pour lister
- Pas d'émojis excessifs (max 2 par réponse)
- Toujours en français
- Termine par "— XELIRA ✦"

⚠️ RÈGLES STRICTES :
1. Si un utilisateur pose une question hors INKDROP, réponds :
   "Désolé, je suis uniquement dédié à INKDROP. Pose-moi une question sur la plateforme !"
2. Si un utilisateur est perdu, guide-le vers les bonnes fonctionnalités
3. Utilise TOUJOURS le prénom de l'utilisateur
4. Sois UTILE avant d'être amical

L'utilisateur s'appelle "${firstName || 'Cher utilisateur'}". Utilise son prénom.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Rotation des clés
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
            messages,
            temperature: 0.5,
            max_tokens: 500,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        
        if (reply) {
          return { success: true, reply: this.cleanReply(reply) };
        }

      } catch (error) {
        continue;
      }
    }

    // Fallback
    return {
      success: true,
      reply: `Bonjour ${firstName || 'cher utilisateur'} ! 😊\n\nJe suis XELIRA, le modérateur de INKDROP. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`,
    };
  }

  private cleanReply(reply: string): string {
    return reply
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[(Image|Photo|Foto)[^\]]*\]/gi, '')
      .trim();
  }
}