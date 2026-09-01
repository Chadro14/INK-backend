import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { BadgeAwardService } from './badge-award.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BadgesController],
  providers: [BadgesService, BadgeAwardService],
  exports: [BadgesService, BadgeAwardService],
})
export class BadgesModule {}
