import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Post()
@UseInterceptors(FileFieldsInterceptor([
  { name: 'pdf', maxCount: 1 },
  { name: 'images', maxCount: 100 },
  { name: 'cover', maxCount: 1 }
]))
async createChapter(
  @UploadedFiles() files: { pdf?: Express.Multer.File[], images?: Express.Multer.File[], cover?: Express.Multer.File[] },
  // ... tes autres paramètres
) {
  return this.chaptersService.create(
    mangaId, userId, dto, 
    files.pdf?.[0], 
    files.images, 
    files.cover?.[0]
  );
}
