import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ViewsService } from './views.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('views')
export class ViewsController {
  constructor(private viewsService: ViewsService) {}

  // ============================================
  // INCRÉMENTER UNE VUE (MANGA ou CHAPITRE)
  // ✅ MÉTHODE TIKTOK : 1 VUE = 1 PERSONNE
  // ============================================
  @Post('increment')
  async incrementView(
    @Body() body: { mangaId: string; chapterId?: string; sessionId?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || null;
    const sessionId = body.sessionId || req.headers['x-session-id'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    return this.viewsService.increment({
      userId,
      mangaId: body.mangaId,
      chapterId: body.chapterId || null,
      sessionId,
      userAgent,
      ipAddress,
    });
  }

  // ============================================
  // VÉRIFIER SI DÉJÀ VU (utilisateur connecté)
  // ============================================
  @Post('check')
  @UseGuards(JwtAuthGuard)
  async checkView(
    @Body() body: { mangaId: string; chapterId?: string },
    @Req() req: any,
  ) {
    return this.viewsService.check(req.user.id, body.mangaId, body.chapterId || null);
  }
}
