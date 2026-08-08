import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  IsUUID,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ChapterMode {
  PHOTOS = 'PHOTOS',
  PDF = 'PDF',
}

// ============================================
// 1. DTO pour la génération des URLs d'upload
// ============================================
export class ChapterUploadUrlsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filenames?: string[];

  @IsOptional()
  @IsIn(['PHOTOS', 'PDF'])
  mode?: ChapterMode;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  count?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  chapterNumber?: number;
}

// ============================================
// 2. DTO pour la finalisation du chapitre
// ============================================
export class FinalizeChapterDto {
  @IsNumber()
  @Type(() => Number)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsArray()
  @IsString({ each: true })
  keys: string[]; // ← Clé unique pour les URLs (PDF ou images)

  @IsString()
  @IsIn(['PHOTOS', 'PDF'])
  mode: 'PHOTOS' | 'PDF';

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  freePageIndexes?: string;
}

// ============================================
// 3. DTO pour la création classique (legacy)
// ============================================
export class CreateChapterDto {
  @IsNumber()
  @Type(() => Number)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsUrl()
  pdfUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesUrls?: string[];

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  freePageIndexes?: string;

  @ValidateIf((o) => !o.pdfUrl && (!o.imagesUrls || o.imagesUrls.length === 0))
  @IsOptional()
  validation?: never;
}

// ============================================
// 4. DTO pour la mise à jour
// ============================================
export class UpdateChapterDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number;
}