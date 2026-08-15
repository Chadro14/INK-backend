import { Module } from '@nestjs/common';
import { MangasController } from './mangas.controller';
import { MangasService } from './mangas.service';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { StorageService } from '../../common/services/storage.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios'; // ✅ AJOUTÉ - Pour les appels API externes (MangaDex)

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }), // ✅ AJOUTÉ - Pour le service MangaApiService si utilisé
  ],
  controllers: [
    MangasController,
    ChaptersController, // ✅ Déjà présent - Correct
  ],
  providers: [
    MangasService,
    ChaptersService,
    StorageService,
    // MangaApiService, // ✅ AJOUTER SI VOUS UTILISEZ L'API MANGADEX
  ],
  exports: [
    MangasService,
    ChaptersService,
    // MangaApiService, // ✅ AJOUTER SI EXPORTÉ
  ],
})
export class MangasModule {}
