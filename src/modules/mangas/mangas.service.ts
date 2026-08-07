import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async findAll(page = 1, limit = 20, filters?: { search?: string; genre?: string; status?: string }) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (filters?.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters?.genre) {
      where.genre = { has: filters.genre };
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    const [data, total] = await Promise.all([
      this.prisma.manga.findMany({
        where,
        skip,
        take: limit,
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.manga.count({ where }),
    ]);
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getTopMangas(limit = 10) {
    return this.prisma.manga.findMany({
      take: limit,
      orderBy: { viewsCount: 'desc' },
      include: { author: true },
    });
  }

  async findById(id: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: { chapters: true, author: true },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }
    return manga;
  }

  async update(id: string, userId: string, dto: any) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé à modifier ce manga');
    }
    return this.prisma.manga.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé à supprimer ce manga');
    }
    return this.prisma.manga.delete({
      where: { id },
    });
  }

  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }
    const key = `covers/${mangaId}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }
    const coverUrl = await this.storage.getSignedUrl(key, 3600 * 24 * 365, 'chapters');
    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverUrl },
    });
  }

  async getUploadUrls(mangaId: string, filenames: string[]) {
    await this.findById(mangaId);
    const results = [];
    for (const filename of filenames) {
      const key = `chapters/${mangaId}/${Date.now()}-${filename}`;
      const upload = await this.storage.getUploadUrl(key, 'chapters');
      results.push({ filename, key, ...upload });
    }
    return results;
  }
}