// src/modules/manas/manas.module.ts
import { Module } from '@nestjs/common';
import { ManasController } from './manas.controller';
import { ManasService } from './manas.service';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ManasController, BalanceController],
  providers: [ManasService, BalanceService, PrismaService],
  exports: [ManasService, BalanceService],
})
export class ManasModule {}
