// src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FollowModule } from '../follow/follow.module';
import { CertificationModule } from '../certification/certification.module';
import { ManasModule } from '../manas/manas.module';

@Module({
  imports: [
    PrismaModule,
    FollowModule,
    CertificationModule,
    ManasModule,        // ✅ AJOUTÉ — pour injecter BalanceService
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
