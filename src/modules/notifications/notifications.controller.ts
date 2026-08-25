// src/modules/notifications/notifications.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // ============================================
  // RÉCUPÉRER TOUTES LES NOTIFICATIONS
  // ============================================
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserNotifications(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.findByUser(userId);
  }

  // ============================================
  // COMPTER LES NOTIFICATIONS NON LUES
  // ============================================
  @Get('unread')
  @UseGuards(JwtAuthGuard)
  async countUnread(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const count = await this.notificationsService.countUnread(userId);
    return { count };
  }

  // ============================================
  // MARQUER COMME LU
  // ============================================
  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.markAsRead(userId, id);
  }

  // ============================================
  // TOUT MARQUER COMME LU
  // ============================================
  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.markAllAsRead(userId);
  }

  // ============================================
  // SUPPRIMER UNE NOTIFICATION
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.delete(userId, id);
  }

  // ============================================
  // TEST - ENVOYER UNE NOTIFICATION DE TEST
  // ============================================
  @Get('test')
  @UseGuards(JwtAuthGuard)
  async testNotification(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const notification = await this.notificationsService.sendTestNotification(userId);
    return {
      success: true,
      message: 'Notification de test envoyée',
      notification,
    };
  }
}
