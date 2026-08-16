// src/modules/payments/controllers/payments.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaymentsService } from '../services/payments.service';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ============================================
  // INITIER UN PAIEMENT
  // ============================================
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async initiatePayment(@Req() req: any, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePayment(req.user.id, dto);
  }

  // ============================================
  // CONFIRMER UN PAIEMENT MANUEL
  // ============================================
  @Post('confirm/:transactionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Req() req: any,
    @Param('transactionId') transactionId: string,
  ) {
    return this.paymentsService.confirmManualPayment(transactionId, req.user.id);
  }

  // ============================================
  // RÉCUPÉRER L'HISTORIQUE DES PAIEMENTS
  // ============================================
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.paymentsService.getUserPayments(req.user.id, page, limit);
  }

  // ============================================
  // VÉRIFIER LE STATUT D'UN PAIEMENT
  // ============================================
  @Get('status/:transactionId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Req() req: any,
    @Param('transactionId') transactionId: string,
  ) {
    return this.paymentsService.getPaymentStatus(transactionId, req.user.id);
  }

  // ============================================
  // ✅ WEBHOOK ORANGE MONEY
  // ============================================
  @Post('webhooks/orange-money')
  @HttpCode(HttpStatus.OK)
  async handleOrangeMoneyWebhook(@Body() payload: any) {
    return this.paymentsService.handleOrangeMoneyWebhook(payload);
  }

  // ============================================
  // ✅ WEBHOOK M-PESA
  // ============================================
  @Post('webhooks/mpesa')
  @HttpCode(HttpStatus.OK)
  async handleMpesaWebhook(@Body() payload: any) {
    return this.paymentsService.handleMpesaWebhook(payload);
  }
}
