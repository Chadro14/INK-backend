import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScraperService } from './scraper.service';
import { ManasService } from './manas.service';
import { CreateAnimeDto } from '../dto/create-anime.dto';
import { SearchAnimeDto } from '../dto/search-anime.dto';

@Injectable()
export class InkstreamService {
  constructor(
    private prisma: PrismaService,
    private scraperService: ScraperService,
    private manasService: ManasService,
  ) {}

  // ============================================
  // 1. RECHERCHER DES ANIMES (API tierce)
  // ============================================
  async searchAnimes(dto: SearchAnimeDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    // Si un terme de recherche est fourni, on utilise l'API externe
    if (q) {
      const results = await this.scraperService.searchByKeyword(q, limit);
      return {
        data: results,
        meta: {
          total: results.length,
          page,
          limit,
          source: 'external',
        },
      };
    }

    // Sinon, on utilise la base de données
    const [animes, total] = await Promise.all([
      this.prisma.inkStreamAnime.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inkStreamAnime.count({ where: { isActive: true } }),
    ]);

    return {
      data: animes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: 'database',
      },
    };
  }

  // ============================================
  // 2. RÉCUPÉRER UN ANIME PAR ID
  // ============================================
  async getAnime(id: string) {
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id },
      include: {
        episodes: {
          orderBy: { episodeNumber: 'asc' },
        },
      },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    return anime;
  }

  // ============================================
  // 3. RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes() {
    // Essayer d'abord la base de données
    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 10,
    });

    if (dbAnimes.length > 0) {
      return dbAnimes;
    }

    // Sinon, utiliser le scraper
    const externalAnimes = await this.scraperService.getPopularAnimes();
    return externalAnimes;
  }

  // ============================================
  // 4. REGARDER UN ÉPISODE
  // ============================================
  async watchEpisode(
    userId: string,
    animeId: string,
    episodeNumber: number,
  ) {
    // Vérifier si l'utilisateur peut regarder
    const canWatch = await this.manasService.canWatchEpisode(
      userId,
      animeId,
      episodeNumber,
    );

    if (!canWatch.canWatch) {
      throw new BadRequestException(canWatch.reason || 'Accès non autorisé');
    }

    // Consommer un MANA si nécessaire
    await this.manasService.consumeMana(userId, animeId, episodeNumber);

    // Récupérer l'épisode
    const episode = await this.prisma.inkStreamEpisode.findFirst({
      where: {
        animeId,
        episodeNumber,
        isAvailable: true,
      },
    });

    if (!episode) {
      throw new NotFoundException('Épisode non trouvé');
    }

    // Mettre à jour l'historique
    await this.prisma.inkStreamWatchHistory.upsert({
      where: {
        userId_episodeId: {
          userId,
          episodeId: episode.id,
        },
      },
      update: {
        lastWatchedAt: new Date(),
      },
      create: {
        userId,
        animeId,
        episodeId: episode.id,
        progress: 0,
      },
    });

    return {
      episode,
      remainingManas: (await this.manasService.getBalance(userId)).manas,
    };
  }

  // ============================================
  // 5. SAUVEGARDER LA PROGRESSION
  // ============================================
  async saveProgress(
    userId: string,
    episodeId: string,
    progress: number,
  ) {
    const watchHistory = await this.prisma.inkStreamWatchHistory.findUnique({
      where: {
        userId_episodeId: {
          userId,
          episodeId,
        },
      },
    });

    if (!watchHistory) {
      throw new NotFoundException('Historique non trouvé');
    }

    await this.prisma.inkStreamWatchHistory.update({
      where: { id: watchHistory.id },
      data: { progress },
    });

    return { success: true };
  }

  // ============================================
  // 6. ADMIN : CRÉER UN ANIME
  // ============================================
  async createAnime(dto: CreateAnimeDto) {
    // Vérifier si l'anime existe déjà
    const existing = await this.prisma.inkStreamAnime.findFirst({
      where: {
        source: dto.source,
        externalId: dto.externalId,
      },
    });

    if (existing) {
      throw new BadRequestException('Cet anime existe déjà');
    }

    return this.prisma.inkStreamAnime.create({
      data: {
        title: dto.title,
        description: dto.description,
        coverImage: dto.coverImage,
        genre: dto.genre || [],
        source: dto.source,
        externalId: dto.externalId,
        externalUrl: dto.externalUrl,
        rating: dto.rating,
        releaseYear: dto.releaseYear,
        episodesCount: dto.episodesCount || 0,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });
  }
}