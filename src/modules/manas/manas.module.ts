import { Module } from '@nestjs/common';
import { ManasService } from './manas.service';
import { ManasController } from './manas.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ManasController],
  providers: [ManasService],
  exports: [ManasService],
})
export class ManasModule {}
