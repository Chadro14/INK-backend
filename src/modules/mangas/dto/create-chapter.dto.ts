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

// DTO flexible : supporte à la fois { filenames } ET { mode, count, chapterNumber }
export class ChapterUploadUrlsDto {
  @IsEnum(ChapterMode)
  @IsOptional()
  mode?: ChapterMode;

  @IsNumber()
  @Min(1)
  @IsOptional()
  count?: number;

  @IsNumber()
  @IsOptional()
  chapterNumber?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  filenames?: string[];
}

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
