import { IsArray, IsString } from 'class-validator';

export class GetUploadUrlsDto {
  @IsArray()
  @IsString({ each: true })
  filenames: string[];
}
