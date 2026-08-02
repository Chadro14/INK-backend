import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MangasService {
  constructor(private prisma: PrismaService) {}

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
      where.genre = filters.genre;
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
      orderBy: { views: 'desc' },
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

  // Gestion des uploads (Supabase / Storage)
  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }
    const key = `covers/${mangaId}-${Date.now()}.jpg`;
    return { key, uploadUrl: `#` }; // À adapter selon ton client Supabase Storage si besoin
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Non autorisé');
    }
    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverImage: key },
    });
  }

  async getUploadUrls(mangaId: string, filenames: string[]) {
    await this.findById(mangaId);
    return filenames.map((filename) => ({
      filename,
      key: `chapters/${mangaId}/${Date.now()}-${filename}`,
      uploadUrl: `#`,
    }));
  }
}
