import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ChapterMode {
  PDF = 'pdf',
  PHOTOS = 'photos',
}

// 1. DTO pour la demande d'URLs d'upload (/upload-urls)
export class ChapterUploadUrlsDto {
  @IsEnum(ChapterMode)
  mode: ChapterMode;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  count: number;

  @IsNumber()
  @Type(() => Number)
  chapterNumber: number;
}

// 2. DTO pour la finalisation du chapitre (/finalize)
export class FinalizeChapterDto {
  @IsEnum(ChapterMode)
  mode: ChapterMode;

  @IsArray()
  @IsString({ each: true })
  keys: string[];

  @IsInt()
  @Type(() => Number)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isDraft?: boolean;

  @IsOptional()
  @IsString()
  freePageIndexes?: string;
}

// Conservé au cas où un autre endroit de ton code l'importe encore
export class CreateChapterDto extends FinalizeChapterDto {}
