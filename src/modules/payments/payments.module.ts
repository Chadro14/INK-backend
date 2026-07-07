import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { OrangeMoneyService } from './services/orange-money.service';
import { MpesaService } from './services/mpesa.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, OrangeMoneyService, MpesaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}