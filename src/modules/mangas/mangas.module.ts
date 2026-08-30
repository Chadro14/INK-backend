import { Module } from '@nestjs/common';
import { MangasController } from './mangas.controller';
import { MangasService } from './mangas.service';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { StorageService } from '../../common/services/storage.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { ViewsModule } from '../views/views.module'; // ✅ AJOUTÉ

@Module({
  imports: [
    PrismaModule,
    ViewsModule, // ✅ AJOUTÉ - Pour que MangasController puisse utiliser ViewsService
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    MangasController,
    ChaptersController,
  ],
  providers: [
    MangasService,
    ChaptersService,
    StorageService,
  ],
  exports: [
    MangasService,
    ChaptersService,
  ],
})
export class MangasModule {}
