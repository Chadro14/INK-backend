// src/modules/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { OrangeMoneyService } from './services/orange-money.service';
import { MpesaService } from './services/mpesa.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    PrismaModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, OrangeMoneyService, MpesaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
