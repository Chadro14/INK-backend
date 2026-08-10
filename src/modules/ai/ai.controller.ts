import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly summaryService: SummaryService,
    private readonly tagService: TagService,
  ) {}

  // ============================================
  // 1. CHAT AVEC XELIRA
  // ============================================
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Request() req: any,
    @Body() body: { message: string; history?: any[]; firstName?: string }
  ) {
    const { message, history = [], firstName = '' } = body;

    if (!message) {
      return { error: 'Message requis' };
    }

    return this.aiService.chat(req.user.id, message, history, firstName);
  }

  // ============================================
  // 2. GÉNÉRER UN RÉSUMÉ DE CHAPITRE
  // ============================================
  @Post('summarize-chapter')
  @UseGuards(JwtAuthGuard)
  async summarizeChapter(
    @Request() req: any,
    @Body() body: {
      chapterId: string;
      title?: string;
      mangaTitle: string;
      chapterNumber: number;
      pageCount?: number;
    }
  ) {
    const { chapterId, title, mangaTitle, chapterNumber, pageCount } = body;

    if (!chapterId || !mangaTitle) {
      return { error: 'chapterId et mangaTitle requis' };
    }

    const contentInfo = pageCount ? `Nombre de pages : ${pageCount}` : '';

    const summary = await this.aiService.generateSummary(
      req.user.id,
      title || '',
      mangaTitle,
      chapterNumber,
      contentInfo,
    );

    // Sauvegarder le résumé dans la BDD
    await this.summaryService.saveSummary(chapterId, summary);

    return { success: true, summary };
  }

  // ============================================
  // 3. RÉCUPÉRER LE RÉSUMÉ D'UN CHAPITRE
  // ============================================
  @Get('summary/:chapterId')
  @UseGuards(JwtAuthGuard)
  async getChapterSummary(@Param('chapterId') chapterId: string) {
    const summary = await this.summaryService.getSummary(chapterId);
    return { summary };
  }

  // ============================================
  // 4. GÉNÉRER DES TAGS POUR UN MANGA
  // ============================================
  @Post('generate-tags')
  @UseGuards(JwtAuthGuard)
  async generateTags(
    @Request() req: any,
    @Body() body: {
      mangaId: string;
      title: string;
      description?: string;
      genres?: string[];
    }
  ) {
    const { mangaId, title, description = '', genres = [] } = body;

    if (!mangaId || !title) {
      return { error: 'mangaId et title requis' };
    }

    const tags = await this.tagService.generateTags(
      req.user.id,
      mangaId,
      title,
      description,
      genres,
    );

    return { success: true, tags };
  }

  // ============================================
  // 5. RÉCUPÉRER LES TAGS D'UN MANGA
  // ============================================
  @Get('tags/:mangaId')
  @UseGuards(JwtAuthGuard)
  async getMangaTags(@Param('mangaId') mangaId: string) {
    const tags = await this.tagService.getTags(mangaId);
    return { tags };
  }
}