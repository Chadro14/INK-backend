import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { Status } from '@prisma/client';

export class CreateMangaDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genre?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsString()
  coverImage?: string;  // Base64 ou URL
}