import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service'; // ✅ AJOUT
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    SummaryService,
    TagService, // ✅ AJOUT
  ],
  exports: [
    AiService,
    SummaryService,
    TagService, // ✅ AJOUT
  ],
})
export class AiModule {}