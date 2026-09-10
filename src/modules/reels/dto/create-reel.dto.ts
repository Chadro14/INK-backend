import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUrl,
  IsNumber,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReelType } from '@prisma/client';

export class CreateReelDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUrl()
  videoUrl: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duration?: number;

  @IsOptional()
  @IsString()
  musicTitle?: string;

  @IsOptional()
  @IsString()
  musicArtist?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  // ✅ NOUVEAU : Type de Reel
  @IsOptional()
  @IsEnum(ReelType)
  type?: ReelType;

  // ✅ NOUVEAU : CTA
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaLabel?: string;

  // ✅ NOUVEAU : Liens vers le contenu INKdrop
  @IsOptional()
  @IsUUID()
  mangaId?: string;

  @IsOptional()
  @IsUUID()
  chapterId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  featuredCreatorId?: string;
}
