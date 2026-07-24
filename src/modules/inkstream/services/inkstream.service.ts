import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MovieboxService } from './moviebox.service';
import { ScraperService } from './scraper.service';
import { SearchAnimeDto } from '../dto/search-anime.dto';

@Injectable()
export class InkstreamService {
  constructor(
    private prisma: PrismaService,
    private movieboxService: MovieboxService,
    private scraperService: ScraperService,
  ) {}

  // ============================================
  // RECHERCHER DES ANIMES (MovieBox + Fallback)
  // ============================================
  async searchAnimes(dto: SearchAnimeDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    // 🔥 1. Essayer MovieBox
    try {
      const movieboxResults = await this.movieboxService.searchAnimes(q, limit);
      if (movieboxResults.length > 0) {
        return {
          data: movieboxResults,
          meta: {
            total: movieboxResults.length,
            page,
            limit,
            source: 'moviebox',
          },
        };
      }
    } catch (error) {
      console.warn('⚠️ MovieBox API failed, falling back to Pinterest');
    }

    // 🔥 2. Fallback : API Pinterest
    const pinterestResults = await this.scraperService.searchByKeyword(q, limit);
    return {
      data: pinterestResults,
      meta: {
        total: pinterestResults.length,
        page,
        limit,
        source: 'pinterest',
      },
    };
  }

  // ============================================
  // RÉCUPÉRER UN ANIME PAR ID
  // ============================================
  async getAnime(id: string) {
    // Essayer d'abord en base de données
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id },
      include: { episodes: true },
    });

    if (anime) {
      return anime;
    }

    // Sinon, chercher via MovieBox
    try {
      const movieboxAnime = await this.movieboxService.getAnimeDetails(id);
      return movieboxAnime;
    } catch (error) {
      throw new NotFoundException('Anime non trouvé');
    }
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
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

    // Sinon, via MovieBox
    try {
      const movieboxAnimes = await this.movieboxService.getPopularAnimes(10);
      return movieboxAnimes;
    } catch (error) {
      // Fallback : Pinterest
      return this.scraperService.getPopularAnimes();
    }
  }

  // ============================================
  // REGARDER UN ÉPISODE
  // ============================================
  async watchEpisode(userId: string, animeId: string, episodeNumber: number) {
    // Récupérer l'anime
    const anime = await this.getAnime(animeId);
    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // Trouver l'épisode
    const episode = anime.episodes?.find(
      (ep: any) => ep.episodeNumber === episodeNumber
    );

    if (!episode) {
      throw new NotFoundException('Épisode non trouvé');
    }

    // Récupérer l'URL de streaming
    let streamUrl = episode.videoUrl;
    if (!streamUrl) {
      try {
        const streamData = await this.movieboxService.getEpisodeStreamUrl(episode.id);
        streamUrl = streamData.videoUrl;
      } catch (error) {
        throw new BadRequestException('Impossible de charger la vidéo');
      }
    }

    return {
      episode,
      streamUrl,
      animeTitle: anime.title,
    };
  }
}