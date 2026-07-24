import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InkstreamController } from './controllers/inkstream.controller';
import { InkstreamService } from './services/inkstream.service';
import { MovieboxService } from './services/moviebox.service';
import { ScraperService } from './services/scraper.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [InkstreamController],
  providers: [InkstreamService, MovieboxService, ScraperService],
  exports: [InkstreamService],
})
export class InkstreamModule {}