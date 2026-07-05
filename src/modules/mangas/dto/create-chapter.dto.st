import { IsInt, IsOptional, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class CreateChapterDto {
  @IsInt()
  @Min(1)
  number: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;  // Si false, le chapitre est payant

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;  // Prix en USD
}