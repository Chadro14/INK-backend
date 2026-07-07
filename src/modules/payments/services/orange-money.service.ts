import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrangeMoneyService {
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get('ORANGE_API_URL') || 'https://api.orange.com/sonatel/webservice';
    this.clientId = this.configService.get('ORANGE_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('ORANGE_CLIENT_SECRET') || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Orange Money: Identifiants manquants dans .env');
    }
  }

  // ============================================
  // 1. OBTENIR UN TOKEN D'ACCÈS (OAuth2)
  // ============================================
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/oauth/v2/token`,
          {
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000 - 60000;

      return this.accessToken;
    } catch (error) {
      console.error('❌ Orange Money: Erreur de token', error.response?.data || error.message);
      throw new UnauthorizedException('Impossible de s\'authentifier auprès d\'Orange Money');
    }
  }

  // ============================================
  // 2. INITIER UN PAIEMENT
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
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payment/v1/transactions`,
          {
            amount: params.amount,
            currency: params.currency,
            payer_msisdn: params.phoneNumber,
            description: params.description,
            merchant_reference: params.transactionId,
            callback_url: `${this.configService.get('API_URL')}/webhooks/orange-money`,
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
        transactionId: response.data.transaction_id || response.data.id,
        status: response.data.status || 'PENDING',
      };
    } catch (error) {
      console.error('❌ Orange Money: Erreur de paiement', error.response?.data || error.message);
      throw new BadRequestException('Le paiement Orange Money a échoué');
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
          `${this.apiUrl}/payment/v1/transactions/${transactionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        status: response.data.status,
        amount: response.data.amount,
      };
    } catch (error) {
      console.error('❌ Orange Money: Erreur de statut', error.response?.data || error.message);
      throw new BadRequestException('Impossible de vérifier le statut de la transaction');
    }
  }
}