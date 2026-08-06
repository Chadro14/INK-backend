import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/services/storage.service'; // Ajuste le chemin si besoin

@Injectable()
export class MangasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService, // 👈 Inscription de StorageService
  ) {}

  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) {
      throw new NotFoundException('Manga introuvable');
    }
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }

    const key = `covers/${mangaId}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) {
      throw new NotFoundException('Manga introuvable');
    }
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }

    // Récupère la vraie URL publique/signée Supabase
    const coverUrl = await this.storage.getSignedUrl(key, 3600 * 24 * 365, 'chapters');

    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverUrl },
    });
  }
}
