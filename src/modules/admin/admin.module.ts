import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FollowModule } from '../follow/follow.module';
import { CertificationModule } from '../certification/certification.module';

@Module({
  imports: [FollowModule, CertificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}