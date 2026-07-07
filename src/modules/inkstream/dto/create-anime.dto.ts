import { IsString, IsOptional, IsArray, IsNumber, IsInt, Min } from 'class-validator';

export class CreateAnimeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genre?: string[];

  @IsString()
  source: string; // 'netflix', 'movie-box', 'pinterest'

  @IsString()
  externalId: string;

  @IsString()
  externalUrl: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  releaseYear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  episodesCount?: number;
}