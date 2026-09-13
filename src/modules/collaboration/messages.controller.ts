import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post('conversations/:id')
  @UseGuards(JwtAuthGuard)
  async send(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body('content') content: string,
  ) {
    const senderId = req.user?.id || req.user?.sub;
    const data = await this.service.sendMessage(conversationId, senderId, content);
    return { success: true, data };
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.service.getMessages(
      conversationId,
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Patch('conversations/:id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: any, @Param('id') conversationId: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.service.markAsRead(conversationId, userId);
  }

  @Get('unread')
  @UseGuards(JwtAuthGuard)
  async countUnread(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.service.countUnread(userId);
  }
}
