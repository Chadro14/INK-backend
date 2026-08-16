// src/modules/payments/dto/initiate-payment.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum, Min, MaxLength } from 'class-validator';

export enum PaymentOperator {
  ORANGE = 'orange',
  MPESA = 'mpesa',
  TEST = 'test',
}

export enum PaymentType {
  PREMIUM = 'PREMIUM',
  CHAPTER = 'CHAPTER',
  TIP = 'TIP',
}

export class InitiatePaymentDto {
  @IsNumber()
  @Min(0.5, { message: 'Le montant minimum est de 0.50 USD' })
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @MaxLength(15, { message: 'Le numéro de téléphone ne doit pas dépasser 15 caractères' })
  phoneNumber: string;

  @IsEnum(PaymentOperator, { message: 'Opérateur non supporté' })
  operator: PaymentOperator;

  @IsEnum(PaymentType, { message: 'Type de paiement invalide' })
  type: PaymentType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  mangaId?: string;

  @IsNumber()
  @IsOptional()
  chapterNumber?: number;

  @IsString()
  @IsOptional()
  plan?: string; // 'monthly' ou 'yearly'
}
