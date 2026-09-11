import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReelsService } from './reels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreateReelDto } from './dto/create-reel.dto';
import { UpdateReelDto } from './dto/update-reel.dto';

@Controller('reels')
export class ReelsController {
  constructor(
    private readonly reelsService: ReelsService,
    private prisma: PrismaService, // ✅ AJOUT pour la recherche d'utilisateurs
  ) {}

  // ============================================
  // 1. FEED DES REELS
  // ============================================
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || null;
    const result = await this.reelsService.getFeed(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
    return { success: true, ...result };
  }

  // ============================================
  // 2. RECHERCHE D'UTILISATEURS (pour mentions @)
  // ✅ DOIT ÊTRE AVANT @Get(':id') sinon capturé
  // ============================================
  @Get('search/users')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') q: string, @Req() req: any) {
    if (!q || q.trim().length < 2) {
      return { success: true, data: [] };
    }

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          {
            OR: [{ username: { contains: q, mode: 'insensitive' } }],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        avatarColor: true,
        isCertified: true,
        badgeColor: true,
      },
      take: 10,
      orderBy: { username: 'asc' },
    });

    return { success: true, data: users };
  }

  // ============================================
  // 3. REELS D'UN UTILISATEUR
  // ============================================
  @Get('user/:userId')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserReels(@Param('userId') userId: string, @Req() req?: any) {
    const viewerId = req?.user?.id || null;
    const reels = await this.reelsService.getUserReels(userId, viewerId);
    return { success: true, data: reels };
  }

  // ============================================
  // 4. DÉTAIL D'UN REEL
  // ============================================
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getReel(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id || null;
    const reel = await this.reelsService.findById(id, userId);
    return { success: true, data: reel };
  }

  // ============================================
  // 5. CRÉER UN REEL
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateReelDto) {
    const reel = await this.reelsService.create(req.user.id, dto);
    return { success: true, data: reel };
  }

  // ============================================
  // 6. METTRE À JOUR UN REEL
  // ============================================
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateReelDto,
  ) {
    const reel = await this.reelsService.update(id, req.user.id, dto);
    return { success: true, data: reel };
  }

  // ============================================
  // 7. SUPPRIMER UN REEL
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    const result = await this.reelsService.delete(id, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 8. LIKER UN REEL
  // ============================================
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async like(@Param('id') id: string, @Req() req: any) {
    const result = await this.reelsService.like(id, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 9. BOOKMARK UN REEL
  // ============================================
  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  async bookmark(@Param('id') id: string, @Req() req: any) {
    const result = await this.reelsService.bookmark(id, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 10. COMPTER UNE VUE
  // ============================================
  @Post(':id/view')
  @UseGuards(OptionalJwtAuthGuard)
  async view(
    @Param('id') id: string,
    @Req() req: any,
    @Body('sessionId') sessionId?: string,
  ) {
    const userId = req?.user?.id || null;
    const result = await this.reelsService.view(
      id,
      userId,
      sessionId || req.headers['x-session-id'] || null,
    );
    return { success: true, ...result };
  }

  // ============================================
  // 11. URL D'UPLOAD POUR VIDÉO
  // ============================================
  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  async getUploadUrl(
    @Req() req: any,
    @Body('filename') filename: string,
  ) {
    const result = await this.reelsService.getUploadUrl(req.user.id, filename);
    return { success: true, data: result };
  }

  // ============================================
  // 12. AJOUTER UN COMMENTAIRE
  // ============================================
  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Param('id') id: string,
    @Req() req: any,
    @Body('content') content: string,
    @Body('parentId') parentId?: string,
  ) {
    if (!content || content.trim().length === 0) {
      return { success: false, message: 'Le contenu est requis' };
    }
    const comment = await this.reelsService.addComment(
      id,
      req.user.id,
      content.trim(),
      parentId,
    );
    return { success: true, data: comment };
  }

  // ============================================
  // 13. RÉCUPÉRER LES COMMENTAIRES D'UN REEL
  // ============================================
  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async getComments(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || null;
    const result = await this.reelsService.getComments(
      id,
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, ...result };
  }

  // ============================================
  // 14. LIKER UN COMMENTAIRE
  // ============================================
  @Post('comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  async likeComment(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const result = await this.reelsService.likeComment(commentId, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 15. SUPPRIMER UN COMMENTAIRE
  // ============================================
  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const result = await this.reelsService.deleteComment(commentId, req.user.id);
    return { success: true, ...result };
  }

  // ============================================
  // 16. VÉRIFIER SI L'UTILISATEUR A LIKÉ UN COMMENTAIRE
  // ============================================
  @Get('comments/:commentId/liked')
  @UseGuards(JwtAuthGuard)
  async hasLikedComment(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const result = await this.reelsService.hasLikedComment(commentId, req.user.id);
    return { success: true, ...result };
  }
}
