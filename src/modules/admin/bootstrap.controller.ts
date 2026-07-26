import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('bootstrap')
export class BootstrapController {
  constructor(private prisma: PrismaService) {}

  @Get('make-admin')
  async makeAdmin(@Query('email') email: string, @Query('secret') secret: string) {
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      throw new ForbiddenException('Secret invalide');
    }

    const user = await this.prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    return { success: true, username: user.username, role: user.role };
  }
}