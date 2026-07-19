import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { FollowModule } from '../follow/follow.module';
import { MangasModule } from '../mangas/mangas.module';

@Module({
  imports: [FollowModule, MangasModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}