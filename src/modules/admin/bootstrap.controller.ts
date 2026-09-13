import {
  Controller,
  Get,
  Query,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManasTransactionType } from '@prisma/client';

@Controller('bootstrap')
export class BootstrapController {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // PROMOUVOIR UN UTILISATEUR EN ADMIN
  // ============================================
  @Get('make-admin')
  async makeAdmin(
    @Query('email') email: string,
    @Query('secret') secret: string,
  ) {
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      throw new ForbiddenException('Secret invalide');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    return { success: true, username: user.username, role: user.role };
  }

  // ============================================
  // DONNER DES MANAS À UN UTILISATEUR (test)
  // ============================================
  @Get('grant-manas')
  async grantManas(
    @Query('email') email: string,
    @Query('amount') amount: string,
    @Query('secret') secret: string,
  ) {
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      throw new ForbiddenException('Secret invalide');
    }

    if (!email || !amount) {
      throw new BadRequestException('email et amount requis');
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestException('amount doit être un entier positif');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, manas: true },
    });

    if (!user) {
      throw new BadRequestException(`Utilisateur ${email} introuvable`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { manas: { increment: parsedAmount } },
        select: { username: true, manas: true },
      }),
      this.prisma.manasTransaction.create({
        data: {
          userId: user.id,
          amount: parsedAmount,
          type: ManasTransactionType.ADMIN_GRANT,
          description: `Grant bootstrap (${parsedAmount} MANAS)`,
          metadata: { source: 'bootstrap/grant-manas' },
        },
      }),
    ]);

    return {
      success: true,
      username: updated.username,
      added: parsedAmount,
      newBalance: updated.manas,
    };
  }

  // ============================================
  // PROMOUVOIR UN UTILISATEUR EN CREATOR CERTIFIÉ (test)
  // ============================================
  @Get('make-creator')
  async makeCreator(
    @Query('email') email: string,
    @Query('secret') secret: string,
  ) {
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      throw new ForbiddenException('Secret invalide');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        role: 'CREATOR',
        isCertified: true,
      },
      select: { username: true, role: true, isCertified: true },
    });

    return {
      success: true,
      username: user.username,
      role: user.role,
      isCertified: user.isCertified,
    };
  }
}
