// src/modules/notifications/notifications.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; // ← Chemins à adapter
import { NotificationsGateway } from './notifications.gateway';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsGateway: NotificationsGateway) {}

  @Get('test')
  @UseGuards(JwtAuthGuard)
  async sendTestNotification(@Req() req: any) {
    const userId = req.user.id;

    this.notificationsGateway.sendNotification(userId, {
      title: '🧪 Test de notification',
      body: 'Si vous voyez ce message, les notifications fonctionnent !',
      type: 'SYSTEM',
    });

    return { message: 'Notification de test envoyée avec succès' };
  }
}
