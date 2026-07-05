import { IsString, IsOptional } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'HIDDEN' | 'DELETED';
}