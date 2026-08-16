// src/modules/payments/services/mpesa.service.ts
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MpesaService {
  private readonly apiUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // ✅ RÉCUPÉRER LES CLÉS DEPUIS .env (PAS EN CLAIR)
    this.apiUrl = this.configService.get('MPESA_API_URL') || 'https://api.vodacom.cd/mpesa';
    this.consumerKey = this.configService.get('MPESA_CONSUMER_KEY') || '';
    this.consumerSecret = this.configService.get('MPESA_CONSUMER_SECRET') || '';

    if (!this.consumerKey || !this.consumerSecret) {
      console.warn('⚠️ M-Pesa: Identifiants manquants dans .env');
    }
  }

  // ============================================
  // 1. OBTENIR UN TOKEN D'ACCÈS
  // ============================================
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/oauth/v1/generate?grant_type=client_credentials`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000 - 60000;

      return this.accessToken;
    } catch (error) {
      console.error('❌ M-Pesa: Erreur de token', error.response?.data || error.message);
      throw new UnauthorizedException('Impossible de s\'authentifier auprès de M-Pesa');
    }
  }

  // ============================================
  // 2. INITIER UN PAIEMENT (C2B)
  // ============================================
  async initiatePayment(params: {
    amount: number;
    currency: string;
    phoneNumber: string;
    description: string;
    transactionId: string;
  }): Promise<{ transactionId: string; status: string }> {
    const token = await this.getAccessToken();

    try {
      // Enregistrer l'URL de confirmation
      await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/c2b/v1/registerurl`,
          {
            ShortCode: this.configService.get('MPESA_SHORTCODE') || '174379',
            ResponseType: 'Completed',
            ConfirmationURL: `${this.configService.get('API_URL')}/payments/webhooks/mpesa/confirmation`,
            ValidationURL: `${this.configService.get('API_URL')}/payments/webhooks/mpesa/validation`,
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Simuler la demande de paiement
      const paymentResponse = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/c2b/v1/simulate`,
          {
            ShortCode: this.configService.get('MPESA_SHORTCODE') || '174379',
            CommandID: 'CustomerPayBillOnline',
            Amount: params.amount,
            Msisdn: params.phoneNumber,
            BillRefNumber: params.transactionId,
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        transactionId: params.transactionId,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('❌ M-Pesa: Erreur de paiement', error.response?.data || error.message);
      throw new BadRequestException('Le paiement M-Pesa a échoué');
    }
  }

  // ============================================
  // 3. VÉRIFIER LE STATUT D'UNE TRANSACTION
  // ============================================
  async getTransactionStatus(transactionId: string): Promise<{ status: string; amount?: number }> {
    const token = await this.getAccessToken();

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/c2b/v1/transactionstatus`,
          {
            params: {
              transactionId,
            },
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        status: response.data.ResultCode === '0' ? 'SUCCESS' : 'FAILED',
        amount: response.data.Amount,
      };
    } catch (error) {
      console.error('❌ M-Pesa: Erreur de statut', error.response?.data || error.message);
      throw new BadRequestException('Impossible de vérifier le statut de la transaction');
    }
  }
}
