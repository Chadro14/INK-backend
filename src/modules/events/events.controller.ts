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
import { EventVotingService } from './event-voting.service';
import { EventRewardsService } from './event-rewards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(
    private eventsService: EventsService,
    private votingService: EventVotingService,
    private rewardsService: EventRewardsService,
  ) {}

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
  // DÉTAIL D'UN ÉVÉNEMENT
  // ============================================
  @Get(':id')
  async getEvent(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const event = await this.eventsService.getEventById(id, userId);
    return { success: true, data: event };
  }

  // ============================================
  // PARTICIPER
  // ============================================
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async joinEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.joinEvent(req.user.id, id);
    return { success: true, data: result };
  }

  // ============================================
  // SOUMETTRE UNE ŒUVRE
  // ============================================
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  async submitToEvent(
    @Param('id') id: string,
    @Req() req: any,
    @Body()
    data: {
      title: string;
      description?: string;
      mangaId?: string;
      chapterId?: string;
      imageUrl?: string;
    },
  ) {
    const result = await this.eventsService.submitToEvent(
      req.user.id,
      id,
      data,
    );
    return { success: true, data: result };
  }

  // ============================================
  // VOTER
  // ============================================
  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  async vote(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { participationId: string; voteType?: string },
  ) {
    const result = await this.votingService.vote(
      req.user.id,
      id,
      body.participationId,
      body.voteType as any,
    );
    return { success: true, data: result };
  }

  // ============================================
  // CLASSEMENT
  // ============================================
  @Get(':id/ranking')
  async getRanking(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const rankings = await this.eventsService.getRanking(
      id,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data: rankings };
  }

  // ============================================
  // RÉCLAMER LES RÉCOMPENSES
  // ============================================
  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  async claimRewards(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.claimRewards(req.user.id, id);
    return { success: true, data: result };
  }

  // ============================================
  // ADMIN : CRÉER UN ÉVÉNEMENT
  // ============================================
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(req.user.id, dto);
    return { success: true, data: event };
  }

  // ============================================
  // ADMIN : METTRE À JOUR
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
  // ADMIN : SUPPRIMER
  // ============================================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteEvent(@Param('id') id: string, @Req() req: any) {
    const result = await this.eventsService.deleteEvent(req.user.id, id);
    return { success: true, ...result };
  }
}
