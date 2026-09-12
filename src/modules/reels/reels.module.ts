import { Module } from '@nestjs/common';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';
import { ReelSchedulerService } from './reel-scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ReelsController],
  providers: [
    ReelsService,
    ReelSchedulerService,
    PrismaService,
    StorageService,
  ],
  exports: [ReelsService],
})
export class ReelsModule {}
