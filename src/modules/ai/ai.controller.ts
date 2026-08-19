// src/modules/ai/ai.controller.ts
import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { ModerationService } from './moderation.service';
import { ToolsService } from './tools.service';
import { FileReaderService } from './file-reader.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly moderationService: ModerationService,
    private readonly toolsService: ToolsService,
    private readonly fileReaderService: FileReaderService,
  ) {}

  // ============================================
  // 1. CHAT PRINCIPAL
  // ============================================
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Request() req: any,
    @Body() body: { message: string; history?: any[]; firstName?: string }
  ) {
    const { message, history = [], firstName = '' } = body;
    if (!message) return { error: 'Message requis' };
    return this.aiService.chat(req.user.id, message, history, firstName);
  }

  // ============================================
  // 2. MODÉRER UN COMMENTAIRE
  // ============================================
  @Post('moderate')
  @UseGuards(JwtAuthGuard)
  async moderateComment(@Request() req: any, @Body('commentId') commentId: string) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    const result = await this.moderationService.analyzeComment(commentId);
    return { success: true, result };
  }

  // ============================================
  // 3. BANNIR UN UTILISATEUR
  // ============================================
  @Post('ban')
  @UseGuards(JwtAuthGuard)
  async banUser(
    @Request() req: any,
    @Body() body: { userId: string; reason: string; permanent?: boolean; duration?: '1d' | '7d' | '30d' | 'permanent' }
  ) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    
    return this.toolsService.banUser({
      userId: body.userId,
      reason: body.reason,
      permanent: body.permanent || false,
      duration: body.duration || '30d',
    }, req.user.id);
  }

  // ============================================
  // 4. AVERTIR UN UTILISATEUR
  // ============================================
  @Post('warn')
  @UseGuards(JwtAuthGuard)
  async warnUser(@Request() req: any, @Body() body: { userId: string; message: string }) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    return this.toolsService.warnUser(body, req.user.id);
  }

  // ============================================
  // 5. SUPPRIMER UN COMMENTAIRE
  // ============================================
  @Post('delete-comment')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Request() req: any, @Body() body: { commentId: string; reason?: string }) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    return this.toolsService.deleteComment(body, req.user.id);
  }

  // ============================================
  // 6. RÉCUPÉRER LE PROFIL D'UN UTILISATEUR
  // ============================================
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Request() req: any, @Param('userId') userId: string) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    return this.toolsService.getUserProfile(userId);
  }

  // ============================================
  // 7. ANALYSER UN FICHIER
  // ============================================
  @Post('analyze-file')
  @UseGuards(JwtAuthGuard)
  async analyzeFile(
    @Request() req: any,
    @Body() body: { filePath: string; errorMessage?: string }
  ) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    const result = await this.fileReaderService.analyzeCode(body.filePath, body.errorMessage);
    return { success: true, result };
  }

  // ============================================
  // 8. STRUCTURE DU PROJET
  // ============================================
  @Get('project-structure')
  @UseGuards(JwtAuthGuard)
  async getProjectStructure(@Request() req: any) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    const result = await this.fileReaderService.analyzeProjectStructure();
    return { success: true, result };
  }

  // ============================================
  // 9. CONTENU SIGNALÉ
  // ============================================
  @Get('reported')
  @UseGuards(JwtAuthGuard)
  async getReportedContent(@Request() req: any) {
    const user = await this.toolsService.getUserProfile(req.user.id);
    if (user.data.role !== 'ADMIN') return { error: 'Accès réservé aux administrateurs.' };
    return this.toolsService.getReportedContent();
  }
}