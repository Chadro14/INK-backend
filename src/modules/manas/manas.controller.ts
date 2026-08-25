// src/modules/manas/manas.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManasService } from './manas.service';
import { ManasTransactionType } from '@prisma/client';

@Controller('manas')
export class ManasController {
  constructor(private manasService: ManasService) {}

  // ============================================
  // RÉCUPÉRER LE SOLDE
  // ============================================
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.getBalance(userId);
  }

  // ============================================
  // HISTORIQUE DES TRANSACTIONS
  // ============================================
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('type') type?: ManasTransactionType,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.getHistory(userId, page, limit, type);
  }

  // ============================================
  // BONUS QUOTIDIEN
  // ============================================
  @Post('daily-bonus')
  @UseGuards(JwtAuthGuard)
  async dailyBonus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.dailyBonus(userId);
  }

  // ============================================
  // ENVOYER DES MANAS À UN AMI
  // ============================================
  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendManas(
    @Req() req: any,
    @Body() body: { receiverId: string; amount: number },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.sendManas(userId, body.receiverId, body.amount);
  }

  // ============================================
  // ACHETER UN CHAPITRE
  // ============================================
  @Post('purchase-chapter')
  @UseGuards(JwtAuthGuard)
  async purchaseChapter(
    @Req() req: any,
    @Body() body: { mangaId: string; chapterNumber: number; priceInManas?: number },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.purchaseChapter(
      userId,
      body.mangaId,
      body.chapterNumber,
      body.priceInManas || 50,
    );
  }

  // ============================================
  // COLLABORER AVEC UN DESSINATEUR
  // ============================================
  @Post('collaborate')
  @UseGuards(JwtAuthGuard)
  async collaborate(
    @Req() req: any,
    @Body() body: { creatorId: string; amountInManas?: number },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.collaborateWithCreator(
      userId,
      body.creatorId,
      body.amountInManas || 250,
    );
  }

  // ============================================
  // (INTERNE) ACTIONS QUI GAGNENT DES MANAS
  // ============================================

  // 📖 Lecture d'un chapitre
  @Post('event/chapter-read')
  @UseGuards(JwtAuthGuard)
  async onChapterRead(
    @Req() req: any,
    @Body() body: { chapterId: string; mangaId: string },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.onChapterRead(userId, body.chapterId, body.mangaId);
  }

  // ❤️ Like reçu
  @Post('event/like-received')
  @UseGuards(JwtAuthGuard)
  async onLikeReceived(
    @Req() req: any,
    @Body() body: { mangaId: string },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.onLikeReceived(userId, body.mangaId);
  }

  // 💬 Commentaire reçu
  @Post('event/comment-received')
  @UseGuards(JwtAuthGuard)
  async onCommentReceived(
    @Req() req: any,
    @Body() body: { mangaId: string },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.onCommentReceived(userId, body.mangaId);
  }

  // 👥 Nouvel abonné
  @Post('event/new-subscriber')
  @UseGuards(JwtAuthGuard)
  async onNewSubscriber(
    @Req() req: any,
    @Body() body: { followerId: string },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.manasService.onNewSubscriber(userId, body.followerId);
  }
}
