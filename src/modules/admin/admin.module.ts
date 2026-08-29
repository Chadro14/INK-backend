// src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FollowModule } from '../follow/follow.module';
import { CertificationModule } from '../certification/certification.module';

@Module({
  imports: [PrismaModule, FollowModule, CertificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService], // ✅ AJOUTER CETTE LIGNE
})
export class AdminModule {}
