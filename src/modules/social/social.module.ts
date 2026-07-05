import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { SubscriptionsService } from './subscriptions.service';

@Module({
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