import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';

export enum ChapterMode {
  PHOTOS = 'PHOTOS',
  PDF = 'PDF',
}

// 1. DTO pour la demande d'URLs d'upload
export class ChapterUploadUrlsDto {
  @IsEnum(ChapterMode)
  mode: ChapterMode;

  @IsNumber()
  @Min(1)
  count: number;

  @IsNumber()
  chapterNumber: number;
}

// 2. DTO pour la finalisation (Upload direct S3/Supabase)
export class FinalizeChapterDto {
  @IsNumber()
  number: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(ChapterMode)
  mode: ChapterMode;

  @IsArray()
  @IsString({ each: true })
  keys: string[];

  @IsOptional()
  @IsString()
  freePageIndexes?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

// 3. DTO classique CreateChapterDto (supporte toutes les anciennes et nouvelles propriétés)
export class CreateChapterDto {
  @IsNumber()
  number: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  pdfUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imagesUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @IsString()
  @IsOptional()
  freePageIndexes?: string;
}
