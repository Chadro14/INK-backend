import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { Status, Role } from '@prisma/client';

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

  // ============================================
  // HELPER : Vérification des droits
  // ============================================
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
  // HELPER : Génération de slug
  // ============================================
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ============================================
  // HELPER : Générer un slug unique
  // ============================================
  private async generateUniqueSlug(baseTitle: string, excludeId?: string): Promise<string> {
    let slug = this.generateSlug(baseTitle);
    
    let existing = await this.prisma.manga.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });

    let counter = 1;
    while (existing) {
      const testSlug = `${slug}-${counter}`;
      existing = await this.prisma.manga.findFirst({
        where: {
          slug: testSlug,
          ...(excludeId && { id: { not: excludeId } }),
        },
        select: { id: true },
      });
      if (!existing) {
        slug = testSlug;
        break;
      }
      counter++;
    }

    return slug;
  }

  // ============================================
  // HELPER : VÉRIFIER LA POSITION DU MANGA (1 SUR 2) - PUBLIC
  // ============================================
  async getMangaPosition(userId: string, mangaId?: string): Promise<{ position: number; isPaidPosition: boolean }> {
    const mangas = await this.prisma.manga.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isPremium: true, createdAt: true },
    });

    if (mangaId) {
      const index = mangas.findIndex(m => m.id === mangaId);
      if (index !== -1) {
        const position = index + 1;
        return {
          position,
          isPaidPosition: position % 2 === 1,
        };
      }
    }

    const position = mangas.length + 1;
    return {
      position,
      isPaidPosition: position % 2 === 1,
    };
  }

  // ============================================
  // HELPER : VÉRIFIER SI L'UTILISATEUR EST CRÉATEUR
  // ============================================
  private async isCreator(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === Role.CREATOR || user?.role === Role.ADMIN;
  }

  // ============================================
  // HELPER : PEUT PUBLIER DES CHAPITRES PAYANTS ?
  // ============================================
  async canPublishPaidChapter(userId: string, mangaId: string): Promise<{ allowed: boolean; reason: string; position?: number }> {
    if (!(await this.isCreator(userId))) {
      return { allowed: false, reason: 'Seuls les créateurs peuvent publier des chapitres payants' };
    }

    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { authorId: true },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    const { position, isPaidPosition } = await this.getMangaPosition(userId, mangaId);

    if (!isPaidPosition) {
      return {
        allowed: false,
        position,
        reason: `Ce manga (position n°${position}) doit être obligatoirement gratuit. Les mangas en position paire sont gratuits.`,
      };
    }

    return {
      allowed: true,
      position,
      reason: `Position n°${position} (impaire) - Vous pouvez rendre ce manga payant.`,
    };
  }

  // ============================================
  // 1. CRÉATION D'UN MANGA
  // ============================================
  async create(userId: string, dto: any) {
    const slug = await this.generateUniqueSlug(dto.title);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'READER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: 'CREATOR' },
      });
      console.log(`✅ Utilisateur ${userId} promu au rôle CREATOR`);
    }

    const { position, isPaidPosition } = await this.getMangaPosition(userId);

    const isPremium = dto.isPremium ?? false;
    if (isPremium && !isPaidPosition) {
      throw new BadRequestException(
        `Ce manga (n°${position}) doit être gratuit car il est en position paire.`
      );
    }

    return this.prisma.manga.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description || null,
        coverUrl: dto.coverUrl || null,
        status: dto.status ? (dto.status as Status) : Status.ONGOING,
        genre: dto.genre || [],
        tags: dto.tags || [],
        isPremium: isPremium && isPaidPosition,
        authorId: userId,
      },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 2. LISTE AVEC FILTRES ET PAGINATION - AJOUT DU FILTRE AUTHORID
  // ============================================
  async findAll(
    page = 1,
    limit = 20,
    filters?: { search?: string; genre?: string; status?: string; authorId?: string },
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (filters?.authorId) {
      where.authorId = filters.authorId;
    }

    if (filters?.search?.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: 'insensitive' } },
        { slug: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
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
  // 3. TOP MANGAS
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
  // 4.b RECHERCHE PAR SLUG
  // ============================================
  async findBySlug(slug: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { slug },
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
  // 4.c RECHERCHE PAR ID OU SLUG
  // ============================================
  async findByIdOrSlug(identifier: string) {
    let manga = await this.prisma.manga.findUnique({
      where: { id: identifier },
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
      manga = await this.prisma.manga.findUnique({
        where: { slug: identifier },
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
    }

    if (!manga) {
      throw new NotFoundException('Manga non trouvé.');
    }

    return manga;
  }

  // ============================================
  // 5. MISE À JOUR DU MANGA
  // ============================================
  async update(id: string, userId: string, dto: any) {
    const manga = await this.findByIdOrSlug(id);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    if (dto.isPremium !== undefined) {
      const { position, isPaidPosition } = await this.getMangaPosition(userId, id);
      
      if (dto.isPremium && !isPaidPosition) {
        throw new BadRequestException(
          `Ce manga (position n°${position}) doit rester gratuit car il est en position paire.`
        );
      }
    }

    const updateData: any = {};
    
    if (dto.title !== undefined) {
      updateData.title = dto.title;
      const newSlug = await this.generateUniqueSlug(dto.title, manga.id);
      updateData.slug = newSlug;
    }
    
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.coverUrl !== undefined) updateData.coverUrl = dto.coverUrl;
    if (dto.status !== undefined && Object.values(Status).includes(dto.status)) {
      updateData.status = dto.status as Status;
    }
    if (dto.genre !== undefined) updateData.genre = dto.genre;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    
    if (dto.isPremium !== undefined) {
      const { isPaidPosition } = await this.getMangaPosition(userId, id);
      updateData.isPremium = dto.isPremium && isPaidPosition;
    }

    return this.prisma.manga.update({
      where: { id: manga.id },
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
    const manga = await this.findByIdOrSlug(id);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    if (manga.coverUrl && !manga.coverUrl.startsWith('http')) {
      await this.storage.delete(manga.coverUrl);
    }

    await this.prisma.manga.delete({
      where: { id: manga.id },
    });

    return { message: 'Manga supprimé avec succès.' };
  }

  // ============================================
  // 7. GESTION DE LA COUVERTURE
  // ============================================
  async getCoverUploadUrl(mangaId: string, userId: string) {
    const manga = await this.findByIdOrSlug(mangaId);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const key = `covers/${manga.id}-${Date.now()}.webp`;
    const upload = await this.storage.getUploadUrl(key, 'chapters');
    return { key, ...upload };
  }

  async finalizeCover(mangaId: string, userId: string, key: string) {
    const manga = await this.findByIdOrSlug(mangaId);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const coverUrl = await this.storage.getSignedUrl(key, 3600 * 24 * 365, 'chapters');

    return this.prisma.manga.update({
      where: { id: manga.id },
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
    const manga = await this.findByIdOrSlug(mangaId);
    const results = [];

    for (const filename of filenames) {
      const key = `chapters/${manga.id}/${Date.now()}-${filename}`;
      const upload = await this.storage.getUploadUrl(key, 'chapters');
      results.push({ filename, key, ...upload });
    }

    return results;
  }

  // ============================================
  // 9. METTRE À JOUR LE SLUG MANUELLEMENT
  // ============================================
  async updateSlug(mangaId: string, newSlug: string, userId: string) {
    const manga = await this.findByIdOrSlug(mangaId);
    await this.checkOwnershipOrAdmin(manga.authorId, userId);

    const existing = await this.prisma.manga.findFirst({
      where: {
        slug: newSlug,
        id: { not: manga.id },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Le slug "${newSlug}" est déjà utilisé.`);
    }

    return this.prisma.manga.update({
      where: { id: manga.id },
      data: { slug: newSlug },
      include: {
        author: { select: AUTHOR_SELECT },
      },
    });
  }

  // ============================================
  // 10. MIGRER LES SLUGS EXISTANTS
  // ============================================
  async migrateSlugs() {
    const mangas = await this.prisma.manga.findMany({
      where: { slug: null },
      select: { id: true, title: true },
    });

    if (mangas.length === 0) {
      return { message: 'Aucun manga à migrer. Tous les mangas ont déjà un slug.' };
    }

    console.log(`🔄 Migration de ${mangas.length} mangas sans slug...`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const manga of mangas) {
      try {
        const slug = await this.generateUniqueSlug(manga.title, manga.id);
        
        await this.prisma.manga.update({
          where: { id: manga.id },
          data: { slug },
        });

        updatedCount++;
        console.log(`✅ Slug généré pour "${manga.title}": ${slug}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Erreur pour "${manga.title}":`, error.message);
      }
    }

    console.log(`✅ ${updatedCount} mangas migrés avec succès !`);
    console.log(`❌ ${errorCount} erreurs rencontrées.`);

    return {
      message: `${updatedCount} mangas migrés avec succès.`,
      updatedCount,
      errorCount,
      total: mangas.length,
    };
  }

  // ============================================
  // 11. INCRÉMENTER LES VUES
  // ============================================
  async incrementView(identifier: string, userId?: string) {
    const manga = await this.findByIdOrSlug(identifier);
    
    if (userId && manga.authorId === userId) {
      return { viewsCount: manga.viewsCount };
    }

    const updated = await this.prisma.manga.update({
      where: { id: manga.id },
      data: { viewsCount: { increment: 1 } },
      select: { viewsCount: true },
    });

    return { viewsCount: updated.viewsCount };
  }

  // ============================================
  // 12. RÉCUPÉRER LES MANGAS D'UN CRÉATEUR AVEC STATS - CORRIGÉ ✅
  // ============================================
  async getCreatorMangasWithStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const mangas = await this.prisma.manga.findMany({
      where: {
        authorId: userId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        coverUrl: true,
        description: true,
        status: true,
        viewsCount: true,
        likesCount: true,
        subscribersCount: true,
        commentsCount: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chapters: true,
            comments: true,
            likes: true,
            subscriptions: true,
            views: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ✅ SIGNER LES URLS DES COUVERTURES
    const signedMangas = await Promise.all(
      mangas.map(async (manga) => {
        let signedCoverUrl = null;
        if (manga.coverUrl) {
          try {
            // Si c'est déjà une URL complète, la garder
            if (manga.coverUrl.startsWith('http://') || manga.coverUrl.startsWith('https://')) {
              signedCoverUrl = manga.coverUrl;
            } else {
              // Sinon, signer l'URL
              signedCoverUrl = await this.storage.getSignedUrl(manga.coverUrl);
            }
          } catch (error) {
            console.error(`❌ Erreur signature URL pour ${manga.title}:`, error.message);
            signedCoverUrl = null;
          }
        }
        return {
          ...manga,
          coverUrl: signedCoverUrl,
        };
      })
    );

    const totalViews = signedMangas.reduce((acc, m) => acc + m.viewsCount, 0);
    const totalLikes = signedMangas.reduce((acc, m) => acc + m.likesCount, 0);
    const totalChapters = signedMangas.reduce((acc, m) => acc + m._count.chapters, 0);
    const totalComments = signedMangas.reduce((acc, m) => acc + m._count.comments, 0);
    const totalSubscribers = signedMangas.reduce((acc, m) => acc + m.subscribersCount, 0);

    return {
      mangas: signedMangas,
      totals: {
        views: totalViews,
        likes: totalLikes,
        chapters: totalChapters,
        comments: totalComments,
        subscribers: totalSubscribers,
      },
    };
  }
}
