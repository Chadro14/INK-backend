import { IsInt, IsOptional, IsString, IsBoolean, IsNumber, Min, IsUUID } from 'class-validator';

export class CreateChapterDto {
  @IsUUID()
  mangaId: string;

  @IsInt()
  @Min(1)
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
  @Min(0)
  price?: number;
}