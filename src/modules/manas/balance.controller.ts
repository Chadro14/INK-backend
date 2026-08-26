// src/modules/manas/balance.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';

@Controller('manas')
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  // ============================================
  // DEMANDE DE RETRAIT
  // ============================================
  @Post('withdrawal')
  @UseGuards(JwtAuthGuard)
  async requestWithdrawal(
    @Req() req: any,
    @Body() body: {
      manasAmount: number;
      mobileNumber: string;
      operator: string;
    },
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.balanceService.requestWithdrawal(
      userId,
      body.manasAmount,
      body.mobileNumber,
      body.operator,
    );
  }

  // ============================================
  // HISTORIQUE DES RETRAITS
  // ============================================
  @Get('withdrawal-history')
  @UseGuards(JwtAuthGuard)
  async getWithdrawalHistory(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.balanceService.getWithdrawalHistory(userId);
  }
}
