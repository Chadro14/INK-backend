import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export enum PaymentOperator {
  ORANGE = 'orange',
  MPESA = 'mpesa',
}

export enum PaymentType {
  PREMIUM = 'premium',
  CHAPTER = 'chapter',
  TIP = 'tip',
}

export class InitiatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentOperator)
  operator: PaymentOperator;

  @IsString()
  phoneNumber: string;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mangaId?: string;

  @IsOptional()
  @IsNumber()
  chapterNumber?: number;
}