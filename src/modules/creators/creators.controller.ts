import { Controller, Get, Query, UseGuards, Param, Req } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  // ============================================
  // RÉCUPÉRER LES CRÉATEURS CERTIFIÉS (TOP)
  // ============================================
  @Get('top')
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

  // ============================================
  // RÉCUPÉRER LES MANGAS D'UN CRÉATEUR
  // ============================================
  @Get(':username/mangas')
  async getCreatorMangas(@Param('username') username: string) {
    const mangas = await this.creatorsService.getCreatorMangas(username);
    return { success: true, data: mangas };
  }

  // ============================================
  // RÉCUPÉRER LES STATISTIQUES D'UN CRÉATEUR
  // ============================================
  @Get(':username/stats')
  async getCreatorStats(@Param('username') username: string) {
    const stats = await this.creatorsService.getCreatorStats(username);
    return { success: true, data: stats };
  }

  // ============================================
  // VÉRIFIER SI ON SUIT UN CRÉATEUR (Protégé)
  // ============================================
  @Get(':username/follow-status')
  @UseGuards(JwtAuthGuard)
  async getFollowStatus(@Req() req: any, @Param('username') username: string) {
    const creator = await this.creatorsService.getCreatorByUsername(username);
    const isFollowing = await this.creatorsService.checkFollowStatus(
      req.user.id,
      creator.id,
    );
    return { success: true, data: { isFollowing } };
  }
}
