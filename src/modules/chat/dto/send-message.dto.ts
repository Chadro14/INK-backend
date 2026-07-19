import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  receiverId: string;

  @IsString()
  @MaxLength(1000)
  content: string;
}