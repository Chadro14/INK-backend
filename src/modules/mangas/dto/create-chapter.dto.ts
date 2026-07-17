import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChapterDto {
  @IsInt()
  @Type(() => Number)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFree?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;
}