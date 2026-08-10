import { Injectable } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SummaryService {
  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  // ============================================
  // GÉNÉRER UN RÉSUMÉ DE CHAPITRE
  // ============================================
  async generateChapterSummary(
    chapterId: string,
    userId: string,
  ): Promise<string> {
    // 1. Récupérer le chapitre
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { manga: true },
    });

    if (!chapter) {
      throw new Error('Chapitre non trouvé');
    }

    // 2. Vérifier que l'utilisateur est l'auteur
    const manga = await this.prisma.manga.findUnique({
      where: { id: chapter.mangaId },
      select: { authorId: true },
    });

    if (manga.authorId !== userId) {
      throw new Error('Vous n\'êtes pas l\'auteur de ce manga');
    }

    // 3. Construire le prompt pour le résumé
    const prompt = this.buildSummaryPrompt(chapter);

    // 4. Appeler l'IA
    const result = await this.aiService.chat(
      userId,
      prompt,
      [],
      'Système',
    );

    if (!result.success) {
      throw new Error('Erreur lors de la génération du résumé');
    }

    // 5. Sauvegarder le résumé dans la BDD
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { summary: result.reply },
    });

    return result.reply;
  }

  // ============================================
  // CONSTRUIRE LE PROMPT
  // ============================================
  private buildSummaryPrompt(chapter: any): string {
    let contentInfo = '';

    // Si c'est un PDF, essayer d'extraire du texte
    if (chapter.contentType === 'PDF' && chapter.pdfKey) {
      contentInfo = 'Contenu : PDF (extraction non disponible automatiquement)';
    } 
    // Si c'est des images
    else if (chapter.contentType === 'IMAGES' && chapter.pages) {
      const pageCount = chapter.pages.length || chapter.pageCount || 0;
      contentInfo = `Nombre de pages : ${pageCount}`;
    }

    return `Résume ce chapitre de manga en 3-4 phrases courtes et accrocheuses.

Titre du manga : ${chapter.manga?.title || 'Inconnu'}
Numéro du chapitre : ${chapter.number}
Titre du chapitre : ${chapter.title || 'Sans titre'}
${contentInfo}

Le résumé doit :
- Être concis (50-80 mots maximum)
- Donner envie de lire
- Ne pas révéler la fin
- Être en français

Résumé :`;
  }

  // ============================================
  // RÉCUPÉRER LE RÉSUMÉ D'UN CHAPITRE
  // ============================================
  async getChapterSummary(chapterId: string): Promise<string | null> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { summary: true },
    });

    return chapter?.summary || null;
  }
}