// src/modules/admin/admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { BalanceService } from '../manas/balance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CertifyUserDto } from './dto/certify-user.dto';
import { ModerateContentDto } from './dto/moderate-content.dto';
import { UserFilterDto } from './dto/user-filter.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly balanceService: BalanceService,
  ) {}

  // ============================================
  // UTILISATEURS
  // ============================================
  @Get('users')
  async getUsers(@Req() req: any, @Query() filter: UserFilterDto) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getUsers(filter);
  }

  @Post('certify')
  async certifyUser(@Req() req: any, @Body() dto: CertifyUserDto) {
    return this.adminService.certifyUser(req.user.id, dto);
  }

  @Post('moderate')
  async moderateContent(@Req() req: any, @Body() dto: ModerateContentDto) {
    return this.adminService.moderateContent(req.user.id, dto);
  }

  @Post('suspend/:userId')
  async suspendUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.suspendUser(req.user.id, userId, reason);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.adminService.getStats(req.user.id);
  }

  // ============================================
  // CRÉATEURS
  // ============================================
  @Post('promote/:userId')
  async promoteToCreator(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.promoteToCreator(req.user.id, userId);
  }

  @Post('revoke/:userId')
  async revokeCreatorStatus(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.revokeCreatorStatus(req.user.id, userId, reason);
  }

  // ============================================
  // PREMIUM
  // ============================================
  @Post('grant-premium/:userId')
  async grantPremium(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('plan') plan: string,
    @Body('durationMonths') durationMonths: number,
  ) {
    return this.adminService.grantPremiumSubscription(
      req.user.id,
      userId,
      plan as any,
      durationMonths || 1,
    );
  }

  // ============================================
  // DEMANDES DE CRÉATEUR
  // ============================================
  @Get('creator-requests')
  async getCreatorRequests(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getCreatorRequests(
      req.user.id,
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('creator-requests/:requestId/approve')
  async approveCreatorRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.adminService.approveCreatorRequest(
      req.user.id,
      requestId,
      reviewNotes,
    );
  }

  @Post('creator-requests/:requestId/reject')
  async rejectCreatorRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.rejectCreatorRequest(
      req.user.id,
      requestId,
      reason,
    );
  }

  // ============================================
  // ✅ RETRAITS (PAYOUTS)
  // ============================================

  /**
   * Liste tous les retraits — filtrable par statut.
   * GET /admin/payouts?status=PENDING&page=1&limit=20
   */
  @Get('payouts')
  async getAllPayouts(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.balanceService.getAllPayouts(req.user.id, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * Détail d'un retrait.
   * GET /admin/payouts/:id
   */
  @Get('payouts/:id')
  async getPayoutDetail(@Req() req: any, @Param('id') id: string) {
    return this.balanceService.getPayoutById(req.user.id, id);
  }

  /**
   * Approuver un retrait : PENDING → PROCESSING.
   * POST /admin/payouts/:id/approve
   */
  @Post('payouts/:id/approve')
  async approveWithdrawal(@Req() req: any, @Param('id') id: string) {
    return this.balanceService.approveWithdrawal(req.user.id, id);
  }

  /**
   * Compléter un retrait : PROCESSING → COMPLETED.
   * POST /admin/payouts/:id/complete
   */
  @Post('payouts/:id/complete')
  async completeWithdrawal(@Req() req: any, @Param('id') id: string) {
    return this.balanceService.completeWithdrawal(req.user.id, id);
  }

  /**
   * Refuser un retrait : PENDING/PROCESSING → FAILED + rembourser.
   * POST /admin/payouts/:id/reject
   * Body: { reason: string }
   */
  @Post('payouts/:id/reject')
  async rejectWithdrawal(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.balanceService.rejectWithdrawal(req.user.id, id, reason);
  }
}
