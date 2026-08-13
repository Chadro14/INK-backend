import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  // ============================================
  // RÉCUPÉRER LES CRÉATEURS CERTIFIÉS (TOP)
  // ============================================
  @Get('top')
  @UseGuards(JwtAuthGuard)
  async getTopCreators(@Query('limit') limit: string = '6') {
    const creators = await this.creatorsService.getTopCreators(parseInt(limit));
    return { success: true, data: creators };
  }

  // ============================================
  // RÉCUPÉRER UN CRÉATEUR PAR USERNAME
  // ============================================
  @Get(':username')
  async getCreator(@Param('username') username: string) {
    const creator = await this.creatorsService.getCreatorByUsername(username);
    return { success: true, data: creator };
  }
}