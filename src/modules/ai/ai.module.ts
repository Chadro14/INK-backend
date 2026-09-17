// src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { AiController } from './ai.controller';

// ✅ Services multi-fournisseurs
import { GroqService } from './groq.service';
import { GeminiService } from './gemini.service';
import { OpenAIService } from './openai.service';
import { AiRouterService } from './ai-router.service';

// ✅ OZYRA — Function calling
import { OzyraService } from './ozyra.service';
import { OzyraToolsService } from './ozyra-tools.service';

// Services IA existants
import { AiService } from './ai.service';
import { ModerationService } from './moderation.service';
import { ToolsService } from './tools.service';
import { FileReaderService } from './file-reader.service';
import { EmailAlertService } from './email-alert.service';
import { SummaryService } from './summary.service';
import { TagService } from './tag.service';
import { SearchService } from './search.service';
import { AssistantService } from './assistant.service';
import { CoachService } from './coach.service';

// Service externe
import { EmailService } from '../../common/services/email.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController],
  providers: [
    // ✅ Multi-fournisseurs
    GroqService,
    GeminiService,
    OpenAIService,
    AiRouterService,

    // ✅ OZYRA — Function calling
    OzyraService,
    OzyraToolsService,

    // Services IA existants
    AiService,
    ModerationService,
    ToolsService,
    FileReaderService,
    EmailAlertService,
    SummaryService,
    TagService,
    SearchService,
    AssistantService,
    CoachService,

    // Service externe
    EmailService,
  ],
  exports: [
    AiService,
    OzyraService,
    OzyraToolsService,
    AiRouterService,
    GroqService,
    GeminiService,
    OpenAIService,
  ],
})
export class AiModule {}
