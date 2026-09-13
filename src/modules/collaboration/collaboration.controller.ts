import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';

@Controller('collaborations')
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  // ============================================
  // CRÉER UNE DEMANDE
  // ============================================
  @Post('request')
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @Req() req: any,
    @Body('receiverId') receiverId: string,
    @Body('message') message?: string,
  ) {
    const senderId = req.user?.id || req.user?.sub;
    const data = await this.service.createRequest(senderId, receiverId, message);
    return { success: true, data };
  }

  // ============================================
  // ACCEPTER
  // ============================================
  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard)
  async accept(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.acceptRequest(userId, id);
    return { success: true, data };
  }

  // ============================================
  // REFUSER
  // ============================================
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  async reject(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.rejectRequest(userId, id);
    return { success: true, ...data };
  }

  // ============================================
  // ANNULER
  // ============================================
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.cancelRequest(userId, id);
    return { success: true, ...data };
  }

  // ============================================
  // DEMANDES REÇUES
  // ============================================
  @Get('received')
  @UseGuards(JwtAuthGuard)
  async getReceived(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.getReceivedRequests(userId);
    return { success: true, data };
  }

  // ============================================
  // DEMANDES ENVOYÉES
  // ============================================
  @Get('sent')
  @UseGuards(JwtAuthGuard)
  async getSent(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.getSentRequests(userId);
    return { success: true, data };
  }

  // ============================================
  // BADGE COUNT — demandes PENDING + messages non lus
  // (AVANT les routes :id pour ne pas être capturé comme un id)
  // ============================================
  @Get('badge-count')
  @UseGuards(JwtAuthGuard)
  async getBadgeCount(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.getBadgeCount(userId);
    return { success: true, data };
  }

  // ============================================
  // MES CONVERSATIONS
  // ============================================
  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getConversations(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.getMyConversations(userId);
    return { success: true, data };
  }

  // ============================================
  // DÉTAIL D'UNE CONVERSATION
  // ============================================
  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.service.getConversation(userId, id);
    return { success: true, data };
  }
}
