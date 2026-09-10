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
  Max,
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

  // ✅ RÈGLE : max 30 secondes
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Max(30, { message: 'La vidéo ne doit pas dépasser 30 secondes' })
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

  // ✅ Type de Reel
  @IsOptional()
  @IsEnum(ReelType)
  type?: ReelType;

  // ✅ CTA
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaLabel?: string;

  // ✅ Liens vers le contenu INKdrop
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
