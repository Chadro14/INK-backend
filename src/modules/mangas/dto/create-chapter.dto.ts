import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateChapterDto {
  @IsInt()
  @Type(() => Number)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  freePageIndexes?: string;

  // URLs transmises directement par le front-end
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesUrls?: string[];

  @IsOptional()
  @IsString()
  coverUrl?: string;
}
