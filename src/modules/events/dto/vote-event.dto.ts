import { IsEnum, IsUUID, IsNotEmpty } from 'class-validator';
import { VoteType } from '@prisma/client'; // ✅ Utiliser l'enum de Prisma directement

export class VoteEventDto {
  @IsUUID()
  @IsNotEmpty()
  submissionId: string;

  @IsEnum(VoteType)
  voteType: VoteType;
}
