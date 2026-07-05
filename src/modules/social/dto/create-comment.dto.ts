import { IsString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  chapterId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsOptional()
  @IsUUID()
  parentId?: string;  // Pour les réponses
}