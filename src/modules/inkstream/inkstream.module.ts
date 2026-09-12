import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InkstreamController } from './controllers/inkstream.controller';
import { InkstreamService } from './services/inkstream.service';
import { MovieboxService } from './services/moviebox.service';
import { ScraperService } from './services/scraper.service';
import { ManasService } from '../manas/manas.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    PrismaModule,
    NotificationsModule,
  ],
  controllers: [InkstreamController],
  providers: [
    InkstreamService,
    MovieboxService,
    ScraperService,
    ManasService,
  ],
  exports: [InkstreamService],
})
export class InkstreamModule {}
