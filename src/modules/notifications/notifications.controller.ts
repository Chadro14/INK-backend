// Dans notifications.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Adapte le chemin selon ton projet
import { NotificationsGateway } from './notifications.gateway';

@Controller('notifications') // Ou un autre préfixe, comme 'test'
export class NotificationsController {
  constructor(private readonly notificationsGateway: NotificationsGateway) {}

  // 👇 AJOUTE CETTE ROUTE
  @Get('test')
  @UseGuards(JwtAuthGuard) // Protège la route (optionnel mais recommandé)
  async sendTestNotification(@Req() req: any) {
    const userId = req.user.id; // Récupère l'ID de l'utilisateur connecté

    this.notificationsGateway.sendNotification(userId, {
      title: '🧪 Test de notification',
      body: 'Si vous voyez ce message, les notifications fonctionnent !',
      type: 'SYSTEM',
    });

    return { message: 'Notification de test envoyée avec succès' };
  }
}
