import { Module } from '@nestjs/common';
import { MangaApiService } from './manga-api.service';
import { MangaApiController } from './manga-api.controller';

@Module({
  controllers: [MangaApiController],
  providers: [MangaApiService],
  exports: [MangaApiService],
})
export class MangaApiModule {}