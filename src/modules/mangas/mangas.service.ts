import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { Status } from '@prisma/client';

@Injectable()
export class MangasService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRÉER UN MANGA
  // ============================================
  async create(userId: string, dto: CreateMangaDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const manga = await this.prisma.manga.create({
      data: {
        title: dto.title,
        description: dto.description,
        genre: dto.genre || [],
        tags: dto.tags || [],
        status: dto.status || Status.ONGOING,
        authorId: userId,
        coverUrl: dto.coverImage || null,
      },
    });

    return manga;
  }

  // ============================================
  // RÉCUPÉRER TOUS LES MANGAS (PAGINÉ)
  // ============================================
  async findAll(page: number = 1, limit: number = 20, filters?: any) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const skip = (safePage - 1) * safeLimit;

    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.genre) {
      where.genre = { has: filters.genre };
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [mangas, total] = await Promise.all([
      this.prisma.manga.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
            },
          },
          _count: {
            select: {
              chapters: true,
              likes: true,
              comments: true,
              subscriptions: true,
            },
          },
        },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.manga.count({ where }),
    ]);

    return {
      data: mangas,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ============================================
  // RÉCUPÉRER UN MANGA PAR ID (AVEC PROTECTION DES VUES)
  // ============================================
  async findById(id: string, userId?: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
            isCertified: true,
          },
        },
        chapters: {
          where: { isDraft: false },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            title: true,
            isFree: true,
            price: true,
            pageCount: true,
            publishedAt: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    // Incrémenter les vues uniquement si l'utilisateur connecté n'est PAS l'auteur
    if (!userId || manga.authorId !== userId) {
      await this.prisma.manga.update({
        where: { id },
        data: { viewsCount: { increment: 1 } },
      });
    }

    return manga;
  }

  // ============================================
  // METTRE À JOUR UN MANGA
  // ============================================
  async update(id: string, userId: string, dto: UpdateMangaDto) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    return this.prisma.manga.update({
      where: { id },
      data: dto,
    });
  }

  // ============================================
  // SUPPRIMER UN MANGA
  // ============================================
  async delete(id: string, userId: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: { chapters: true },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    return this.prisma.manga.delete({
      where: { id },
    });
  }

  // ============================================
  // TOP MANGA DU MOIS
  // ============================================
  async getTopMangas(limit: number = 10) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mangas = await this.prisma.manga.findMany({
      where: {
        status: Status.ONGOING,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
            isCertified: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            subscriptions: true,
          },
        },
      },
      orderBy: [
        { viewsCount: 'desc' },
        { likesCount: 'desc' },
        { subscribersCount: 'desc' },
      ],
      take: safeLimit,
    });

    return mangas.map((manga, index) => {
      const score =
        manga.viewsCount * 1 +
        manga._count.likes * 5 +
        manga._count.subscriptions * 10 +
        manga._count.comments * 3;

      return {
        ...manga,
        rank: index + 1,
        score,
        engagement: {
          views: manga.viewsCount,
          likes: manga._count.likes,
          comments: manga._count.comments,
          subscribers: manga._count.subscriptions,
        },
      };
    });
  }
}
