import { IsEnum, IsUUID, IsNotEmpty } from 'class-validator';

export enum VoteType {
  UP = 'UP',
  DOWN = 'DOWN',
  STAR_1 = 'STAR_1',
  STAR_2 = 'STAR_2',
  STAR_3 = 'STAR_3',
  STAR_4 = 'STAR_4',
  STAR_5 = 'STAR_5',
}

export class VoteEventDto {
  @IsUUID()
  @IsNotEmpty()
  submissionId: string;

  @IsEnum(VoteType)
  voteType: VoteType;
}
