import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { AssistantService } from './assistant.service';
import { SearchService } from './search.service';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly summaryService: SummaryService,
    private readonly tagService: TagService,
    private readonly assistantService: AssistantService,
    private readonly searchService: SearchService,
    private readonly coachService: CoachService,
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

  // ============================================
  // 6. ASSISTANT ÉDITEUR - SUGGESTIONS D'IDÉES
  // ============================================
  @Post('assistant/ideas')
  @UseGuards(JwtAuthGuard)
  async suggestIdeas(
    @Request() req: any,
    @Body() body: {
      context: string;
      characters?: string[];
      genre?: string;
    }
  ) {
    const { context, characters = [], genre = '' } = body;

    if (!context) {
      return { error: 'Le contexte est requis' };
    }

    const ideas = await this.assistantService.suggestIdeas(
      req.user.id,
      context,
      characters,
      genre,
    );

    return { success: true, ideas };
  }

  // ============================================
  // 7. ASSISTANT ÉDITEUR - DIALOGUE
  // ============================================
  @Post('assistant/dialogue')
  @UseGuards(JwtAuthGuard)
  async suggestDialogue(
    @Request() req: any,
    @Body() body: {
      character1: string;
      character2: string;
      situation: string;
    }
  ) {
    const { character1, character2, situation } = body;

    if (!character1 || !character2 || !situation) {
      return { error: 'character1, character2 et situation sont requis' };
    }

    const dialogue = await this.assistantService.suggestDialogue(
      req.user.id,
      character1,
      character2,
      situation,
    );

    return { success: true, dialogue };
  }

  // ============================================
  // 8. ASSISTANT ÉDITEUR - DESCRIPTION DE SCÈNE
  // ============================================
  @Post('assistant/describe')
  @UseGuards(JwtAuthGuard)
  async describeScene(
    @Request() req: any,
    @Body() body: {
      sceneType: string;
      mood: string;
      elements?: string[];
    }
  ) {
    const { sceneType, mood, elements = [] } = body;

    if (!sceneType || !mood) {
      return { error: 'sceneType et mood sont requis' };
    }

    const description = await this.assistantService.describeScene(
      req.user.id,
      sceneType,
      mood,
      elements,
    );

    return { success: true, description };
  }

  // ============================================
  // 9. ASSISTANT ÉDITEUR - RÉÉCRITURE
  // ============================================
  @Post('assistant/rewrite')
  @UseGuards(JwtAuthGuard)
  async rewriteText(
    @Request() req: any,
    @Body() body: {
      text: string;
      style: 'plus dynamique' | 'plus poétique' | 'plus simple' | 'plus sérieux';
    }
  ) {
    const { text, style } = body;

    if (!text || !style) {
      return { error: 'text et style sont requis' };
    }

    const rewritten = await this.assistantService.rewriteText(
      req.user.id,
      text,
      style,
    );

    return { success: true, rewritten };
  }

  // ============================================
  // 10. RECHERCHE INTELLIGENTE
  // ============================================
  @Post('search')
  @UseGuards(JwtAuthGuard)
  async intelligentSearch(
    @Request() req: any,
    @Body() body: {
      query: string;
      limit?: number;
    }
  ) {
    const { query, limit = 10 } = body;

    if (!query || query.length < 2) {
      return { error: 'La recherche doit contenir au moins 2 caractères' };
    }

    const results = await this.searchService.intelligentSearch(
      req.user.id,
      query,
      limit,
    );

    return { success: true, results, count: results.length };
  }

  // ============================================
  // 11. SUGGESTIONS DE TAGS POUR RECHERCHE
  // ============================================
  @Post('search/tags')
  @UseGuards(JwtAuthGuard)
  async suggestSearchTags(
    @Request() req: any,
    @Body() body: { query: string }
  ) {
    const { query } = body;

    if (!query || query.length < 2) {
      return { error: 'La recherche doit contenir au moins 2 caractères' };
    }

    const tags = await this.searchService.suggestSearchTags(req.user.id, query);
    return { success: true, tags };
  }

  // ============================================
  // 12. COACH - ANALYSE D'UN MANGA
  // ============================================
  @Post('coach/analyze')
  @UseGuards(JwtAuthGuard)
  async analyzeManga(
    @Request() req: any,
    @Body() body: { mangaId: string }
  ) {
    const { mangaId } = body;

    if (!mangaId) {
      return { error: 'mangaId requis' };
    }

    try {
      const analysis = await this.coachService.analyzeManga(req.user.id, mangaId);
      return { success: true, analysis };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ============================================
  // 13. COACH - SUGGESTIONS D'AMÉLIORATION
  // ============================================
  @Post('coach/improve')
  @UseGuards(JwtAuthGuard)
  async suggestImprovements(
    @Request() req: any,
    @Body() body: {
      title: string;
      description?: string;
      genres?: string[];
    }
  ) {
    const { title, description = '', genres = [] } = body;

    if (!title) {
      return { error: 'title requis' };
    }

    const improvements = await this.coachService.suggestImprovements(
      req.user.id,
      title,
      description,
      genres,
    );

    return { success: true, improvements };
  }

  // ============================================
  // 14. COACH - CONSEILS DE CROISSANCE
  // ============================================
  @Post('coach/growth')
  @UseGuards(JwtAuthGuard)
  async growthAdvice(
    @Request() req: any,
    @Body() body: { mangaId: string }
  ) {
    const { mangaId } = body;

    if (!mangaId) {
      return { error: 'mangaId requis' };
    }

    try {
      const advice = await this.coachService.growthAdvice(req.user.id, mangaId);
      return { success: true, advice };
    } catch (error) {
      return { error: error.message };
    }
  }
}