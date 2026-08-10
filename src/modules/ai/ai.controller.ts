import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly summaryService: SummaryService,
  ) {}

  // ============================================
  // CHAT AVEC XELIRA
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
  // GÉNÉRER UN RÉSUMÉ DE CHAPITRE
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

    // Sauvegarder le résumé dans la BDD via SummaryService
    await this.summaryService.saveSummary(chapterId, summary);

    return { success: true, summary };
  }

  // ============================================
  // RÉCUPÉRER LE RÉSUMÉ D'UN CHAPITRE
  // ============================================
  @Get('summary/:chapterId')
  @UseGuards(JwtAuthGuard)
  async getChapterSummary(@Param('chapterId') chapterId: string) {
    const summary = await this.summaryService.getSummary(chapterId);
    return { summary };
  }
}