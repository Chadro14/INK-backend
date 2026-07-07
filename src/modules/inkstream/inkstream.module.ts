import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InkstreamController } from './controllers/inkstream.controller';
import { ManasController } from './controllers/manas.controller';
import { InkstreamService } from './services/inkstream.service';
import { ScraperService } from './services/scraper.service';
import { ManasService } from './services/manas.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [InkstreamController, ManasController],
  providers: [InkstreamService, ScraperService, ManasService],
  exports: [InkstreamService, ManasService],
})
export class InkstreamModule {}