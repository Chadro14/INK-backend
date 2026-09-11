import { Module } from '@nestjs/common';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';
import { ReelSchedulerService } from './reel-scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [ReelsController],
  providers: [
    ReelsService,
    ReelSchedulerService, // ✅ AJOUT
    PrismaService,
    StorageService,
  ],
  exports: [ReelsService],
})
export class ReelsModule {}
