// src/modules/manas/manas.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManasService } from './manas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasTransactionType } from '@prisma/client';

@Controller('manas')
export class ManasController {
  constructor(
    private manasService: ManasService,
    private prisma: PrismaService,
  ) {}

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
  // COLLABORATION AVEC UN DESSINATEUR (ancien système)
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
  // ADMIN — DONNER DES MANAS À UN UTILISATEUR
  // ============================================
  @Post('admin/grant')
  @UseGuards(JwtAuthGuard)
  async grantManas(
    @Req() req: any,
    @Body('userId') userId: string,
    @Body('amount') amount: number,
    @Body('reason') reason?: string,
  ) {
    const adminId = req.user?.id || req.user?.sub;

    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new ForbiddenException('Réservé aux administrateurs');
    }

    if (!userId || !amount || amount <= 0) {
      throw new BadRequestException('userId et amount (positif) requis');
    }

    const result = await this.manasService.addManas(
      userId,
      amount,
      reason || `Grant admin (${amount} MANAS)`,
      ManasTransactionType.ADMIN_GRANT,
      { adminId },
    );

    return { success: true, ...result };
  }
}
