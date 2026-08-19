// src/modules/ai/dto/moderation.dto.ts
import { IsString, IsOptional, IsUUID, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class ModerateCommentDto {
  @IsUUID()
  commentId: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  content?: string;
}

export class ModerateUserDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BanUserDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean = false;

  @IsOptional()
  duration?: '1d' | '7d' | '30d' | 'permanent';
}

export class WarnUserDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  message: string;
}

export class DeleteCommentDto {
  @IsUUID()
  commentId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AnalyzeFileDto {
  @IsString()
  filePath: string;

  @IsOptional()
  @IsString()
  context?: string;
}

export class EmailAlertDto {
  @IsString()
  problem: string;

  @IsString()
  details: string;

  @IsOptional()
  files?: string[];

  @IsOptional()
  suggestedFix?: string;

  @IsOptional()
  urgency?: 'low' | 'medium' | 'high' | 'critical' = 'medium';
}