import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('active')
  async getActiveEvents() {
    return this.eventsService.getActiveEvents();
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinEvent(@Req() req: any, @Body('eventId') eventId: string) {
    return this.eventsService.joinEvent(req.user.id, eventId);
  }

  @Get('progress/:eventId')
  @UseGuards(JwtAuthGuard)
  async getProgress(@Req() req: any, @Param('eventId') eventId: string) {
    return this.eventsService.getUserProgress(req.user.id, eventId);
  }

  // Admin routes
  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }
    return this.eventsService.createEvent(dto);
  }
}