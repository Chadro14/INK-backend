import { IsUUID, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CertifyUserDto {
  @IsUUID()
  userId: string;

  @IsBoolean()
  certify: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  badgeColor?: string;
}