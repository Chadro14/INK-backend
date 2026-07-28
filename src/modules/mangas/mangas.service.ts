import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { Status } from '@prisma/client';

@Injectable()
export class MangasService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

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
  // UPLOADER / METTRE À JOUR LA COUVERTURE (NOUVEAU 🎉)
  // ============================================
  async updateCover(id: string, userId: string, file: Express.Multer.File) {
    // 1. Vérifier si le manga existe
    const manga = await this.prisma.manga.findUnique({
      where: { id },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    // 2. Vérifier que l'utilisateur est bien l'auteur (sécurité)
    if (manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    try {
      // 3. Générer un nom de fichier unique et l'envoyer au Storage
      // On extrait l'extension de l'image (ex: .png, .jpg)
      const extension = file.originalname.split('.').pop();
      const key = `mangas/${id}/cover-${Date.now()}.${extension}`;
      
      // Utilisation de ton service de stockage existant pour uploader le fichier
      const coverUrl = await this.storage.upload(key, file.buffer, file.mimetype);

      // 4. Mettre à jour l'URL de l'image dans la base de données Prisma
      return await this.prisma.manga.update({
        where: { id },
        data: { coverUrl },
      });
    } catch (error) {
      throw new BadRequestException("Erreur lors de l'enregistrement de l'image de couverture.");
    }
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
  // RÉCUPÉRER UN MANGA PAR ID
  // ============================================
  async findById(id: string) {
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
            coverUrl: true,
            contentType: true,
            pages: true,
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

    await this.prisma.manga.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    // Génère une vignette de secours à partir de la 1ère page si le chapitre n'a pas de couverture dédiée
    const chaptersWithThumbnails = await Promise.all(
      manga.chapters.map(async (chapter: any) => {
        const { pages, contentType, ...rest } = chapter;

        if (rest.coverUrl) {
          return rest;
        }

        if (contentType === 'IMAGES' && Array.isArray(pages) && pages.length > 0) {
          try {
            const firstPage = pages[0] as { key: string };
            const thumbnailUrl = await this.storage.getSignedUrl(firstPage.key, 3600);
            return { ...rest, coverUrl: thumbnailUrl };
          } catch {
            return rest;
          }
        }

        return rest;
      }),
    );

    return { ...manga, chapters: chaptersWithThumbnails };
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
