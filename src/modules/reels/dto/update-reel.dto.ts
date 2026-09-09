import { PartialType } from '@nestjs/mapped-types';
import { CreateReelDto } from './create-reel.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ReelStatus } from '@prisma/client';

export class UpdateReelDto extends PartialType(CreateReelDto) {
  @IsOptional()
  @IsEnum(ReelStatus)
  status?: ReelStatus;
}
