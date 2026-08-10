import { Module } from '@nestjs/common';
import { InkstreamService } from './inkstream.service';
import { InkstreamController } from './inkstream.controller';

@Module({
  controllers: [InkstreamController],
  providers: [InkstreamService],
  exports: [InkstreamService],
})
export class InkstreamModule {}