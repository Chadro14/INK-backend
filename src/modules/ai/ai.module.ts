import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { AssistantService } from './assistant.service';
import { SearchService } from './search.service';
import { CoachService } from './coach.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [
    AiService,
    SummaryService,
    TagService,
    AssistantService,
    SearchService,
    CoachService,
  ],
  exports: [
    AiService,
    SummaryService,
    TagService,
    AssistantService,
    SearchService,
    CoachService,
  ],
})
export class AiModule {}