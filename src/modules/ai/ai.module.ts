// src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { AiController } from './ai.controller';

// Services multi-fournisseurs (NOUVEAU)
import { GroqService } from './groq.service';
import { GeminiService } from './gemini.service';
import { OpenAIService } from './openai.service';
import { AiRouterService } from './ai-router.service';

// Services IA
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
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [AiController],
  providers: [
    // ✅ Les 4 services multi-fournisseurs (INDISPENSABLES)
    GroqService,
    GeminiService,
    OpenAIService,
    AiRouterService,

    // Services IA
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
    AiRouterService,
    GroqService,
    GeminiService,
    OpenAIService,
  ],
})
export class AiModule {}
