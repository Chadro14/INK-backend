
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';

@Injectable()
export class MangasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateMangaDto) {
    return this.prisma.manga.create({
      data: {
        ...dto,
        authorId: userId,
      },
    });
  }

  async findAll(page: number, limit: number, filters: { search?: string; genre?: string; status?: string }) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.genre) {
      where.genres = { has: filters.genre };
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.manga.findMany({
        skip,
        take: limit,
        where,
        include: { author: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.manga.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, email: true } },
        chapters: { orderBy: { number: 'asc' } },
      },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    return manga;
  }

  async update(id: string, userId: string, dto: UpdateMangaDto) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    return this.prisma.manga.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const manga = await this.findById(id);
    if (manga.authorId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    return this.prisma.manga.delete({ where: { id } });
  }

  // ============================================
  // UPLOAD DIRECT DE LA COUVERTURE (URL Signée & Publique)
  // ============================================
  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    const key = `covers/${mangaId}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findById(mangaId);
    if (manga.authorId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    // CORRECTION : On récupère la vraie URL publique complète de Supabase
    const coverUrl = this.storage.getPublicUrl(key, 'chapters');

    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverUrl },
    });
  }

  async getUploadUrls(mangaId: string, filenames: string[]) {
    const uploadPromises = filenames.map(async (filename) => {
      const key = `mangas/${mangaId}/${Date.now()}-${filename}`;
      const uploadData = await this.storage.getUploadUrl(key, 'chapters');
      return {
        filename,
        key,
        path: uploadData.path,
        token: uploadData.token,
      };
    });

    return { files: await Promise.all(uploadPromises) };
  }

  async getTopMangas(limit: number) {
    return this.prisma.manga.findMany({
      take: limit,
      orderBy: { viewsCount: 'desc' }, 
      include: { author: { select: { id: true, email: true } } },
    });
  }
}
