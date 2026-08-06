import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class MangasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(userId: string, dto: any) {
    return this.prisma.manga.create({
      data: {
        ...dto,
        authorId: userId,
      },
    });
  }

  // ✅ Corrigé : accepte 3 arguments (page, limit, filters)
  async findAll(page?: number, limit?: number, filters?: any) {
    const take = limit ? Number(limit) : 20;
    const skip = page ? (Number(page) - 1) * take : 0;

    return this.prisma.manga.findMany({
      take,
      skip,
      where: {
        ...(filters?.search && {
          title: { contains: filters.search, mode: 'insensitive' },
        }),
        ...(filters?.genre && { genre: filters.genre }),
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Corrigé : trie par createdAt au lieu du champ views inexistant
  async getTopMangas(limit = 10) {
    return this.prisma.manga.findMany({
      take: Number(limit) || 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const manga = await this.prisma.manga.findUnique({ where: { id } });
    if (!manga) throw new NotFoundException('Manga introuvable');
    return manga;
  }

  async update(id: string, userId: string, dto: any) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) throw new ForbiddenException('Non autorisé');
    return this.prisma.manga.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) throw new ForbiddenException('Non autorisé');
    await this.prisma.manga.delete({ where: { id } });
    return { message: 'Manga supprimé avec succès' };
  }

  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) throw new ForbiddenException('Non autorisé');
    const key = `covers/${mangaId}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) throw new ForbiddenException('Non autorisé');
    const coverUrl = await this.storage.getSignedUrl(key, 3600 * 24 * 365, 'chapters');
    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverUrl },
    });
  }

  async getUploadUrls(mangaId: string, filenames: string[]) {
    return Promise.all(
      filenames.map(async (filename) => {
        const key = `mangas/${mangaId}/${Date.now()}-${filename}`;
        const upload = await this.storage.getUploadUrl(key, 'chapters');
        return { filename, key, ...upload };
      }),
    );
  }
}
