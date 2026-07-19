import { IsString } from 'class-validator';

export class JoinEventDto {
  @IsString()
  eventId: string;
} 