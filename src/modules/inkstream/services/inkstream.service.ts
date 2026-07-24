import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MovieboxService } from './moviebox.service';
import { ManasService } from '../../manas/manas.service';
import { SearchAnimeDto } from '../dto/search-anime.dto';

@Injectable()
export class InkstreamService {
  constructor(
    private prisma: PrismaService,
    private movieboxService: MovieboxService,
    private manasService: ManasService,
  ) {}

  // ============================================
  // RECHERCHER DES ANIMES
  // ============================================
  async searchAnimes(dto: SearchAnimeDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    try {
      const anilistResults = await this.movieboxService.searchAnimes(q, limit);
      if (anilistResults.length > 0) {
        return {
          data: anilistResults,
          meta: {
            total: anilistResults.length,
            page,
            limit,
            source: 'anilist',
          },
        };
      }
    } catch (error) {
      console.warn('⚠️ Anilist API failed');
    }

    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
        isActive: true,
      },
      skip,
      take: limit,
    });

    return {
      data: dbAnimes,
      meta: {
        total: dbAnimes.length,
        page,
        limit,
        source: 'database',
      },
    };
  }

  // ============================================
  // RÉCUPÉRER UN ANIME PAR ID
  // ============================================
  async getAnime(id: string) {
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id },
      include: { episodes: true },
    });

    if (anime) {
      return anime;
    }

    try {
      const anilistAnime = await this.movieboxService.getAnimeDetails(id);
      return anilistAnime;
    } catch (error) {
      throw new NotFoundException('Anime non trouvé');
    }
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes() {
    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 10,
    });

    if (dbAnimes.length > 0) {
      return dbAnimes;
    }

    try {
      const anilistAnimes = await this.movieboxService.getPopularAnimes(10);
      return anilistAnimes;
    } catch (error) {
      console.warn('⚠️ Anilist popular failed');
      return [];
    }
  }

  // ============================================
  // REGARDER UN ÉPISODE (consomme un MANA + historique)
  // ============================================
  async watchEpisode(userId: string, animeId: string, episodeNumber: number) {
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    const result = await this.manasService.consumeMana(userId, animeId, episodeNumber);

    return {
      success: result.success,
      remainingManas: result.remainingManas,
      anime: {
        id: anime.id,
        title: anime.title,
      },
      episodeNumber,
    };
  }
}