import { Module } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { CollaborationController } from './collaboration.controller';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CollaborationController, MessagesController],
  providers: [CollaborationService, MessagesService],
  exports: [CollaborationService, MessagesService],
})
export class CollaborationModule {}
