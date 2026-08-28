import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // ============================================
  // SOLDE DE TICKETS
  // ============================================
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Request() req: any) {
    try {
      return await this.ticketsService.getBalance(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération du solde',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // RÉCLAMER LE TICKET QUOTIDIEN
  // ============================================
  @Post('daily')
  @UseGuards(JwtAuthGuard)
  async claimDaily(@Request() req: any) {
    try {
      return await this.ticketsService.claimDailyTicket(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la réclamation du ticket',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================
  // UTILISER UN TICKET (DÉBLOQUER UN CHAPITRE)
  // ============================================
  @Post('use/:chapterId')
  @UseGuards(JwtAuthGuard)
  async useTicket(@Request() req: any, @Param('chapterId') chapterId: string) {
    try {
      return await this.ticketsService.useTicket(req.user.id, chapterId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'utilisation du ticket',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================
  // RÉCLAMER UN TICKET D'ÉVÉNEMENT
  // ============================================
  @Post('event/:eventId')
  @UseGuards(JwtAuthGuard)
  async claimEvent(@Request() req: any, @Param('eventId') eventId: string) {
    try {
      return await this.ticketsService.claimEventTicket(req.user.id, eventId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la réclamation du ticket événement',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================
  // HISTORIQUE DES TICKETS
  // ============================================
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Request() req: any, @Request() query: any) {
    try {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      return await this.ticketsService.getHistory(req.user.id, page, limit);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération de l\'historique',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
