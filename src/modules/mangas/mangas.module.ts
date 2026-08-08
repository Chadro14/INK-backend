import { Module } from '@nestjs/common';
import { MangasController } from './mangas.controller';
import { MangasService } from './mangas.service';
import { ChaptersController } from './chapters.controller'; // ✅ AJOUTER
import { ChaptersService } from './chapters.service';
import { StorageService } from '../../common/services/storage.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    MangasController,
    ChaptersController, // ✅ AJOUTER CETTE LIGNE
  ],
  providers: [MangasService, ChaptersService, StorageService],
  exports: [MangasService, ChaptersService],
})
export class MangasModule {}