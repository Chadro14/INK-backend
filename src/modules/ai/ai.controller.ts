import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Request() req: any,
    @Body() body: { message: string; history?: any[]; firstName?: string }
  ) {
    const { message, history = [], firstName = '' } = body;

    if (!message) {
      return { error: 'Message requis' };
    }

    return this.aiService.chat(req.user.id, message, history, firstName);
  }
}