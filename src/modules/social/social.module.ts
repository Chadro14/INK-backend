import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SocialController],
  providers: [
    SocialService,
    CommentsService,
    LikesService,
    SubscriptionsService,
  ],
  exports: [
    SocialService,
    CommentsService,
    LikesService,
    SubscriptionsService,
  ],
})
export class SocialModule {}
