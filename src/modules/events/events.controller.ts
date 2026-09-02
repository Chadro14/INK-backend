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
import { SubmitEventDto } from './dto/submit-event.dto';
import { VoteEventDto } from './dto/vote-event.dto';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  // ============================================
  // LISTE DES ÉVÉNEMENTS
  // ============================================
  @Get()
  async getEvents(
    @Req() req: any,
    @Query('filter') filter?: 'all' | 'active' | 'upcoming' | 'past',
  ) {
    const userId = req.user?.id;
    const events = await this.eventsService.getEvents(userId, filter);
    return { success: true, data: events };
  }

  // ============================================
  // RÉCUPÉRER UN ÉVÉNEMENT PAR ID
  // ============================================
  @Get(':id')
  async getEvent(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const event = await this.eventsService.getEventById(id, userId);
    return { success: true, data: event };
  }

  // ============================================
  // PARTICIPER À UN ÉVÉNEMENT
  // ============================================
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async joinEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.joinEvent(req.user.id, id);
    return { success: true, data: result };
  }

  // ============================================
  // RÉCUPÉRER LE CLASSEMENT
  // ============================================
  @Get(':id/ranking')
  async getRanking(@Param('id') id: string, @Query('limit') limit?: string) {
    const rankings = await this.eventsService.getRanking(
      id,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data: rankings };
  }

  // ============================================
  // SOUMETTRE UNE ŒUVRE À UN ÉVÉNEMENT
  // ============================================
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  async submitToEvent(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: SubmitEventDto,
  ) {
    const submission = await this.eventsService.submitToEvent(req.user.id, id, dto);
    return { success: true, data: submission };
  }

  // ============================================
  // VOTER POUR UNE SOUMISSION
  // ============================================
  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  async voteForSubmission(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: VoteEventDto,
  ) {
    const vote = await this.eventsService.voteForSubmission(req.user.id, id, dto);
    return { success: true, data: vote };
  }

  // ============================================
  // RÉCUPÉRER LA PROGRESSION DE L'UTILISATEUR
  // ============================================
  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  async getUserProgress(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const progress = await this.eventsService.getUserEventProgress(req.user.id, id);
    return { success: true, data: progress };
  }

  // ============================================
  // CRÉER UN ÉVÉNEMENT (ADMIN)
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(req.user.id, dto);
    return { success: true, data: event };
  }

  // ============================================
  // METTRE À JOUR UN ÉVÉNEMENT (ADMIN)
  // ============================================
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

  // ============================================
  // SUPPRIMER UN ÉVÉNEMENT (ADMIN)
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.deleteEvent(req.user.id, id);
    return { success: true, ...result };
  }
}
