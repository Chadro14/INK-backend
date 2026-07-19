import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StatsQueryDto } from './dto/stats-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  async getOverview(@Req() req: any) {
    return this.dashboardService.getOverview(req.user.id);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any, @Query() query: StatsQueryDto) {
    return this.dashboardService.getStats(req.user.id, query);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  async getEarnings(@Req() req: any) {
    return this.dashboardService.getEarnings(req.user.id);
  }
}