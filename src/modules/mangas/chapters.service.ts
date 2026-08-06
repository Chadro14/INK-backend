// Dans chapters.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService, // 👈 Injecté proprement grâce à ton MangasModule
  ) {}

  async generateUploadUrls(mangaId: string, filenames: string[]) {
    const results = await Promise.all(
      filenames.map(async (filename) => {
        const key = `chapters/${mangaId}/${Date.now()}-${filename}`;
        const upload = await this.storage.getUploadUrl(key, 'chapters');
        return { filename, key, ...upload };
      })
    );

    return results;
  }
}
