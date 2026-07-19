import { IsUUID, IsString, IsEnum, IsOptional } from 'class-validator';

export enum ModerationAction {
  HIDE = 'HIDE',
  DELETE = 'DELETE',
  WARN = 'WARN',
  SUSPEND = 'SUSPEND',
}

export class ModerateContentDto {
  @IsUUID()
  targetId: string;

  @IsEnum(ModerationAction)
  action: ModerationAction;

  @IsString()
  reason: string;
}