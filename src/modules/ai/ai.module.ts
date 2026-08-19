// src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { AssistantService } from './assistant.service';
import { SearchService } from './search.service';
import { CoachService } from './coach.service';
import { ModerationService } from './moderation.service';
import { ToolsService } from './tools.service';
import { FileReaderService } from './file-reader.service';
import { EmailAlertService } from './email-alert.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService } from '../../common/services/email.service';

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
    ModerationService,   // 🆕
    ToolsService,        // 🆕
    FileReaderService,   // 🆕
    EmailAlertService,   // 🆕
    EmailService,        // 🆕 (pour les alertes)
  ],
  exports: [
    AiService,
    SummaryService,
    TagService,
    AssistantService,
    SearchService,
    CoachService,
    ModerationService,
    ToolsService,
  ],
})
export class AiModule {}