import { IsString, IsOptional, IsBoolean, IsArray, IsUrl, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReelDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  videoUrl: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duration?: number;

  @IsOptional()
  @IsString()
  musicTitle?: string;

  @IsOptional()
  @IsString()
  musicArtist?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
