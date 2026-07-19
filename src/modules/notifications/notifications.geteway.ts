import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  // ============================================
  // CONNEXION
  // ============================================
  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(client.id);
    }
  }

  // ============================================
  // DÉCONNEXION
  // ============================================
  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  // ============================================
  // ENVOYER UNE NOTIFICATION À UN UTILISATEUR
  // ============================================
  sendNotification(userId: string, notification: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit('notification', notification);
      }
    }
  }

  // ============================================
  // ENVOYER UNE NOTIFICATION DE MASSE
  // ============================================
  broadcastNotification(notification: any) {
    this.server.emit('notification', notification);
  }
}