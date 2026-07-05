import { Module } from '@nestjs/common';
import { MangasController } from './mangas.controller';
import { MangasService } from './mangas.service';
import { ChaptersService } from './chapters.service';
import { StorageService } from '../../common/services/storage.service';
import { PDFProcessorService } from '../../common/services/pdf-processor.service';

@Module({
  controllers: [MangasController],
  providers: [
    MangasService,
    ChaptersService,
    StorageService,
    PDFProcessorService,
  ],
  exports: [MangasService, ChaptersService],
})
export class MangasModule {}