import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  async getEvents(
    @Req() req: any,
    @Query('filter') filter?: 'all' | 'active' | 'upcoming' | 'past',
  ) {
    const userId = req.user?.id;
    const events = await this.eventsService.getEvents(userId, filter);
    return { success: true, data: events };
  }

  @Get(':id')
  async getEvent(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const event = await this.eventsService.getEventById(id, userId);
    return { success: true, data: event };
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async joinEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.joinEvent(req.user.id, id);
    return { success: true, data: result };
  }

  @Get(':id/ranking')
  async getRanking(@Param('id') id: string, @Query('limit') limit?: string) {
    const rankings = await this.eventsService.getRanking(
      id,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data: rankings };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(req.user.id, dto);
    return { success: true, data: event };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateEvent(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.eventsService.updateEvent(req.user.id, id, dto);
    return { success: true, data: event };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.deleteEvent(req.user.id, id);
    return { success: true, ...result };
  }
}
