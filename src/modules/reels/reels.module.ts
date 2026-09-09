import { Module } from '@nestjs/common';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [ReelsController],
  providers: [ReelsService, PrismaService, StorageService],
  exports: [ReelsService],
})
export class ReelsModule {}
