import { IsOptional, IsString } from 'class-validator';

export class UpdateCertificationDto {
  @IsOptional()
  @IsString()
  badgeColor?: string;
}