import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { Status, Role } from '@prisma/client';

// Sélection restreinte pour ne jamais exposer les données sensibles de l'utilisateur
const AUTHOR_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  avatarColor: true,
  isCertified: true,
  badgeColor: true,
  role: true,
};

@Injectable()
export class MangasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // Helper privé : Vérification des droits (Auteur du manga ou Admin)
  private async checkOwnershipOrAdmin(mangaAuthorId: string, userId: string) {
    if (mangaAuthorId === userId) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== Role.ADMIN) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à modifier ce manga.");
    }
  }

  // ============================================
  // 1. CRÉATION D'UN MANGA
  // ============================================
  async create(userId: string, dto: any) {
    return this.prisma.manga.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        coverUrl: dto.coverUrl || null,
        status: dto.status ? (dto.status as Status) : Status.ONGOING,
        genre: dto.genre || [],
        tags: dto.tags || [],
        isPremium: dto.isPremium ?? false,
        authorId: userId,
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 2. LISTE AVEC FILTRES ET PAGINATION
  // ============================================
  async findAll(
    page = 1,
    limit = 20,
    filters?: { search?: string; genre?: string; status?: string },
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (filters?.search?.trim()) {
      where.title = { contains: filters.search.trim(), mode: 'insensitive' };
    }

    if (filters?.genre?.trim()) {
      where.genre = { has: filters.genre.trim() };
    }

    if (filters?.status && Object.values(Status).includes(filters.status as Status)) {
      where.status = filters.status as Status;
    }

    const [data, total] = await Promise.all([
      this.prisma.manga.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          author: { select: AUTHOR_SELECT },
          _count: {
            select: { chapters: true, likes: true, subscriptions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.manga.count({ where }),
    ]);

    return {
      data,
      total,
      page: pageNum,
      lastPage: Math.ceil(total / limitNum) || 1,
    };
  }

  // ============================================
  // 3. TOP MANGAS (PAR POPULARITÉ)
  // ============================================
  async getTopMangas(limit = 10) {
    const limitNum = Math.max(1, Number(limit) || 10);

    return this.prisma.manga.findMany({
      take: limitNum,
      orderBy: [{ viewsCount: 'desc' }, { likesCount: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
        _count: {
          select: { chapters: true },
        },
      },
    });
  }

  // ============================================
  // 4. RECHERCHE PAR ID
  // ============================================
  async findById(id: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        chapters: {
          where: { isDraft: false },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            title: true,
            contentType: true,
            isFree: true,
            price: true,
            viewsCount: true,
            createdAt: true,
            publishedAt: true,
          },
        },
        _count: {
          select: {
            chapters: true,
            comments: true,
            likes: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé.');
    }

    return manga;
  }

  // ============================================
  // 5. MISE À JOUR DU MANGA
  // ============================================
  async update(id: string, userId: string, dto: any) {
    const manga = await this.findById(id);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.coverUrl !== undefined) updateData.coverUrl = dto.coverUrl;
    if (dto.status !== undefined && Object.values(Status).includes(dto.status)) {
      updateData.status = dto.status as Status;
    }
    if (dto.genre !== undefined) updateData.genre = dto.genre;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.isPremium !== undefined) updateData.isPremium = dto.isPremium;

    return this.prisma.manga.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 6. SUPPRESSION DU MANGA
  // ============================================
  async delete(id: string, userId: string) {
    const manga = await this.findById(id);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    if (manga.coverUrl && !manga.coverUrl.startsWith('http')) {
      await this.storage.delete(manga.coverUrl);
    }

    await this.prisma.manga.delete({
      where: { id },
    });

    return { message: 'Manga supprimé avec succès.' };
  }

  // ============================================
  // 7. GESTION DE LA COUVERTURE
  // ============================================
  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findById(mangaId);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const key = `covers/${mangaId}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findById(mangaId);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const coverUrl = await this.storage.getSignedUrl(key, 3600 * 24 * 365, 'chapters');

    return this.prisma.manga.update({
      where: { id: mangaId },
      data: { coverUrl },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 8. URLS D'UPLOAD POUR FICHIERS
  // ============================================
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
