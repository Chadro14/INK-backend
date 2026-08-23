import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';

@Module({
  controllers: [ViewsController],
  providers: [ViewsService, PrismaService],
  exports: [ViewsService],
})
export class ViewsModule {}
