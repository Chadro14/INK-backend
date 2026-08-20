// src/modules/premium/premium.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule'; // ✅ AJOUTÉ
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // ✅ AJOUTÉ POUR LE CRON
  ],
  controllers: [PremiumController],
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
