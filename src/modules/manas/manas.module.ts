// src/modules/manas/manas.module.ts
import { Module } from '@nestjs/common';
import { ManasController } from './manas.controller';
import { ManasService } from './manas.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ManasController],
  providers: [ManasService, PrismaService],
  exports: [ManasService],
})
export class ManasModule {}
