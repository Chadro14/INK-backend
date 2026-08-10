import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

  // ============================================
  // CHAT AVEC GROQ (rotation des clés)
  // ============================================
  async chat(
    userId: string,
    message: string,
    history: any[] = [],
    firstName: string = '',
  ) {
    if (!message) {
      throw new BadRequestException('Message requis');
    }

    // ✅ Récupérer le nom depuis la BDD si non fourni
    let userName = firstName;
    if (!userName || userName === '') {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        userName = user?.username || 'Utilisateur';
      } catch (error) {
        userName = 'Utilisateur';
      }
    }

    // ✅ Nettoyer le nom (enlever @ si présent)
    userName = userName.replace(/^@/, '');

    // ✅ Vérifier les clés
    if (this.groqKeys.length === 0) {
      return {
        success: true,
        reply: `⚠️ Service momentanément indisponible. Réessaie plus tard. — XELIRA ✦`,
      };
    }

    // ✅ Construction du prompt système (sans répétition de "Bonjour")
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
1. L'utilisateur s'appelle "${userName}". Utilise son nom UNIQUEMENT en début de première réponse de la conversation si nécessaire. Ensuite, arrête de répéter son nom à chaque message. Sois naturel et va droit au but.
2. Si un utilisateur pose une question hors INKDROP, réponds :
   "Désolé, je suis uniquement dédié à INKDROP. Pose-moi une question sur la plateforme !"
3. Sois UTILE avant d'être amical.
4. N'utilise JAMAIS "Bonjour", "Salut" ou "Coucou" dans tes réponses sauf si l'utilisateur te le demande explicitement. Commence directement par le contenu utile.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // ✅ Rotation des clés
    for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
      const key = this.groqKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.groqKeys.length;

      try {
        console.log(`🔄 Tentative avec clé ${attempt + 1}/${this.groqKeys.length}`);

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
          console.log(`❌ Clé ${attempt + 1} échouée:`, data.error?.message || response.status);
          continue;
        }

        const reply = data.choices?.[0]?.message?.content;
        
        if (reply) {
          console.log(`✅ Réponse avec clé ${attempt + 1}`);
          return { success: true, reply: this.cleanReply(reply) };
        }

      } catch (error) {
        console.error(`❌ Erreur clé ${attempt + 1}:`, error.message);
      }
    }

    // ✅ Fallback
    return {
      success: true,
      reply: `Bonjour ${userName} ! 😊\n\nJe suis XELIRA, le modérateur de INKDROP. Comment puis-je t'aider aujourd'hui ?\n\n— XELIRA ✦`,
    };
  }

  // ============================================
  // GÉNÉRER UN RÉSUMÉ DE CHAPITRE (pour l'IA)
  // ============================================
  async generateSummary(
    userId: string,
    chapterTitle: string,
    mangaTitle: string,
    chapterNumber: number,
    contentInfo: string,
  ): Promise<string> {
    const prompt = `Résume ce chapitre de manga en 3-4 phrases courtes et accrocheuses.

Titre du manga : ${mangaTitle}
Numéro du chapitre : ${chapterNumber}
Titre du chapitre : ${chapterTitle || 'Sans titre'}
${contentInfo}

Le résumé doit :
- Être concis (50-80 mots maximum)
- Donner envie de lire
- Ne pas révéler la fin
- Être en français

Résumé :`;

    const result = await this.chat(userId, prompt, [], 'Système');
    return result.reply;
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
}