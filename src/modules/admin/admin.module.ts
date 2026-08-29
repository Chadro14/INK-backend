import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Put,
  Delete,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CertifyUserDto } from './dto/certify-user.dto';
import { ModerateContentDto } from './dto/moderate-content.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { PremiumPlan } from '@prisma/client';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // LISTE DES UTILISATEURS
  // ============================================
  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers(@Req() req: any, @Query() filter: UserFilterDto) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getUsers(filter);
  }

  // ============================================
  // CERTIFIER UN UTILISATEUR
  // ============================================
  @Post('certify')
  @UseGuards(JwtAuthGuard)
  async certifyUser(@Req() req: any, @Body() dto: CertifyUserDto) {
    return this.adminService.certifyUser(req.user.id, dto);
  }

  // ============================================
  // ✅ PROMOUVOIR EN DESSINATEUR
  // ============================================
  @Post('promote-creator/:userId')
  @UseGuards(JwtAuthGuard)
  async promoteToCreator(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.promoteToCreator(req.user.id, userId);
  }

  // ============================================
  // ✅ RÉVOQUER LE STATUT DE DESSINATEUR
  // ============================================
  @Post('revoke-creator/:userId')
  @UseGuards(JwtAuthGuard)
  async revokeCreatorStatus(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.revokeCreatorStatus(req.user.id, userId, reason);
  }

  // ============================================
  // ✅ LISTE DES DEMANDES DE DESSINATEUR
  // ============================================
  @Get('creator-requests')
  @UseGuards(JwtAuthGuard)
  async getCreatorRequests(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.adminService.checkAdmin(req.user.id);
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    return this.adminService.getCreatorRequests(req.user.id, status, pageNum, limitNum);
  }

  // ============================================
  // ✅ APPOUVER UNE DEMANDE DE DESSINATEUR
  // ============================================
  @Post('creator-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard)
  async approveCreatorRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.adminService.approveCreatorRequest(req.user.id, requestId, reviewNotes);
  }

  // ============================================
  // ✅ REFUSER UNE DEMANDE DE DESSINATEUR
  // ============================================
  @Post('creator-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectCreatorRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.rejectCreatorRequest(req.user.id, requestId, reason);
  }

  // ============================================
  // ✅ OFFRIR UN ABONNEMENT PREMIUM
  // ============================================
  @Post('grant-premium/:userId')
  @UseGuards(JwtAuthGuard)
  async grantPremiumSubscription(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { plan: PremiumPlan; durationMonths: number },
  ) {
    return this.adminService.grantPremiumSubscription(
      req.user.id,
      userId,
      body.plan || PremiumPlan.MONTHLY,
      body.durationMonths || 1,
    );
  }

  // ============================================
  // MODÉRATION DU CONTENU
  // ============================================
  @Post('moderate')
  @UseGuards(JwtAuthGuard)
  async moderateContent(@Req() req: any, @Body() dto: ModerateContentDto) {
    return this.adminService.moderateContent(req.user.id, dto);
  }

  // ============================================
  // SUSPENDRE UN UTILISATEUR
  // ============================================
  @Post('suspend/:userId')
  @UseGuards(JwtAuthGuard)
  async suspendUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.suspendUser(req.user.id, userId, reason);
  }

  // ============================================
  // STATISTIQUES GLOBALES
  // ============================================
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) {
    return this.adminService.getStats(req.user.id);
  }
}
