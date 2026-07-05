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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';

@Controller('social')
export class SocialController {
  constructor(
    private commentsService: CommentsService,
    private likesService: LikesService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  // ============================================
  // LIKES
  // ============================================

  @Post('like/:mangaId')
  @UseGuards(JwtAuthGuard)
  async likeManga(@Req() req, @Param('mangaId') mangaId: string) {
    return this.likesService.like(req.user.id, mangaId);
  }

  @Post('like/chapter/:chapterId')
  @UseGuards(JwtAuthGuard)
  async likeChapter(@Req() req, @Param('chapterId') chapterId: string) {
    // Le paramètre chapterId est passé comme ID du chapitre
    // Mais le like est toujours sur un manga
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { mangaId: true },
    });
    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }
    return this.likesService.like(req.user.id, chapter.mangaId, chapterId);
  }

  @Get('has-liked/:mangaId')
  @UseGuards(JwtAuthGuard)
  async hasLiked(@Req() req, @Param('mangaId') mangaId: string) {
    return this.likesService.hasLiked(req.user.id, mangaId);
  }

  // ============================================
  // COMMENTAIRES
  // ============================================

  @Post('comment/:mangaId')
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Req() req,
    @Param('mangaId') mangaId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(req.user.id, mangaId, dto);
  }

  @Get('comments/:mangaId')
  async getComments(
    @Param('mangaId') mangaId: string,
    @Query() query: CommentQueryDto,
  ) {
    return this.commentsService.findByManga(mangaId, query);
  }

  @Get('comments/chapter/:chapterId')
  async getChapterComments(
    @Param('chapterId') chapterId: string,
    @Query() query: CommentQueryDto,
  ) {
    return this.commentsService.findByChapter(chapterId, query);
  }

  @Put('comment/:commentId')
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Req() req,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(req.user.id, commentId, dto);
  }

  @Delete('comment/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Req() req, @Param('commentId') commentId: string) {
    return this.commentsService.delete(req.user.id, commentId);
  }

  @Post('comment-like/:commentId')
  @UseGuards(JwtAuthGuard)
  async likeComment(@Req() req, @Param('commentId') commentId: string) {
    return this.commentsService.likeComment(req.user.id, commentId);
  }

  // ============================================
  // ABONNEMENTS
  // ============================================

  @Post('subscribe/:mangaId')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req, @Param('mangaId') mangaId: string) {
    return this.subscriptionsService.subscribe(req.user.id, mangaId);
  }

  @Get('is-subscribed/:mangaId')
  @UseGuards(JwtAuthGuard)
  async isSubscribed(@Req() req, @Param('mangaId') mangaId: string) {
    return this.subscriptionsService.isSubscribed(req.user.id, mangaId);
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  async getUserSubscriptions(@Req() req) {
    return this.subscriptionsService.getUserSubscriptions(req.user.id);
  }

  @Get('subscribers/:mangaId')
  async getMangaSubscribers(
    @Param('mangaId') mangaId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.subscriptionsService.getMangaSubscribers(mangaId, page, limit);
  }
}