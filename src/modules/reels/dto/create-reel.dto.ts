import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
  Max,
  Min,
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

  // ✅ Clé (pas URL)
  @IsString()
  videoUrl: string;

  // ✅ Clé (pas URL)
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  // ✅ RÈGLE : max 30 secondes
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Max(30, { message: 'La vidéo ne doit pas dépasser 30 secondes' })
  duration?: number;

  // ✅ NOUVEAU : Trim virtuel (début en secondes)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'Le début du trim ne peut pas être négatif' })
  trimStart?: number;

  // ✅ NOUVEAU : Trim virtuel (fin en secondes)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'La fin du trim ne peut pas être négative' })
  trimEnd?: number;

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

  // ✅ NOUVEAU : Publication programmée (date ISO)
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

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

  // ✅ NOUVEAU : IDs des utilisateurs mentionnés
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Chaque mention doit être un UUID valide' })
  mentionIds?: string[];
}
