import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MangaApiService } from './manga-api.service';
import { MangaApiController } from './manga-api.controller';
import { ImagesController } from './images.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MangaApiController, ImagesController],
  providers: [MangaApiService],
  exports: [MangaApiService],
})
export class MangaApiModule {}