import { IsString, IsOptional, IsDateString, IsArray, IsNumber, IsBoolean } from 'class-validator';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  theme: string; // 'naruto', 'blue-lock', 'demon-slayer', etc.

  @IsOptional()
  @IsString()
  icon?: string; // '🥷', '⚽', '🗡️', etc.

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  objectives?: Array<{ type: string; target: number; reward: string }>;

  @IsOptional()
  @IsArray()
  rewards?: Array<{ type: string; name: string; icon: string }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}