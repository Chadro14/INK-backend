import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    SummaryService, // ✅ AJOUT
  ],
  exports: [
    AiService,
    SummaryService, // ✅ AJOUT
  ],
})
export class AiModule {}