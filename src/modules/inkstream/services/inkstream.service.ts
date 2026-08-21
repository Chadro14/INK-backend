// src/modules/inkstream/services/inkstream.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MovieboxService } from './moviebox.service';
import { ManasService } from './manas.service';
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
    const { q, page = 1, limit = 20, genre, source } = dto;
    const skip = (page - 1) * limit;

    // 1. Recherche par mot-clé sur AniList
    if (q) {
      try {
        const results = await this.movieboxService.searchAnimes(q, limit);
        if (results.length > 0) {
          return {
            data: results,
            meta: {
              total: results.length,
              page,
              limit,
              source: 'anilist',
            },
          };
        }
      } catch (error) {
        console.warn('⚠️ Anilist search failed:', error.message);
      }
    }

    // 2. Recherche par genre sur AniList
    if (genre) {
      try {
        const results = await this.movieboxService.getAnimesByGenre(genre, limit);
        if (results.length > 0) {
          return {
            data: results,
            meta: {
              total: results.length,
              page,
              limit,
              source: 'anilist',
            },
          };
        }
      } catch (error) {
        console.warn('⚠️ Anilist genre search failed:', error.message);
      }
    }

    // 3. Fallback : recherche en base de données
    const where: any = {};
    
    if (q) {
      where.title = { contains: q, mode: 'insensitive' };
    }
    
    if (genre) {
      where.genre = { has: genre };
    }
    
    if (source) {
      where.source = source;
    }

    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where,
      skip,
      take: limit,
      orderBy: { rating: 'desc' },
    });

    // 4. Si rien en base, retourner les tendances AniList
    if (dbAnimes.length === 0 && !q && !genre) {
      try {
        const trending = await this.movieboxService.getTrendingAnimes(limit);
        if (trending.length > 0) {
          return {
            data: trending,
            meta: {
              total: trending.length,
              page,
              limit,
              source: 'anilist-trending',
            },
          };
        }
      } catch (error) {
        console.warn('⚠️ Anilist trending failed:', error.message);
      }
    }

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
    // 1. Rechercher en base de données
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id },
      include: { episodes: true },
    });

    if (anime) {
      return anime;
    }

    // 2. Rechercher sur AniList (si ID numérique)
    const isNumeric = /^\d+$/.test(id);
    if (isNumeric) {
      try {
        const anilistAnime = await this.movieboxService.getAnimeDetails(id);
        if (anilistAnime) {
          return anilistAnime;
        }
      } catch (error) {
        console.warn('⚠️ Anilist details failed:', error.message);
      }
    }

    throw new NotFoundException('Anime non trouvé');
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES POPULAIRES
  // ============================================
  async getPopularAnimes() {
    // 1. Essayer la base de données
    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 10,
    });

    if (dbAnimes.length > 0) {
      return dbAnimes;
    }

    // 2. Fallback : AniList
    try {
      const anilistAnimes = await this.movieboxService.getPopularAnimes(10);
      if (anilistAnimes.length > 0) {
        return anilistAnimes;
      }
    } catch (error) {
      console.warn('⚠️ Anilist popular failed:', error.message);
    }

    return [];
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES TENDANCES
  // ============================================
  async getTrendingAnimes() {
    try {
      const trending = await this.movieboxService.getTrendingAnimes(10);
      if (trending.length > 0) {
        return trending;
      }
    } catch (error) {
      console.warn('⚠️ Anilist trending failed:', error.message);
    }

    // Fallback : les plus populaires en base
    return this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { viewsCount: 'desc' },
      take: 10,
    });
  }

  // ============================================
  // RÉCUPÉRER LES ANIMES PAR GENRE
  // ============================================
  async getAnimesByGenre(genre: string, limit: number = 20) {
    try {
      const results = await this.movieboxService.getAnimesByGenre(genre, limit);
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn('⚠️ Anilist genre failed:', error.message);
    }

    // Fallback : base de données
    return this.prisma.inkStreamAnime.findMany({
      where: { genre: { has: genre } },
      take: limit,
    });
  }

  // ============================================
  // REGARDER UN ÉPISODE (consomme 1 MANA + historique)
  // ============================================
  async watchEpisode(userId: string, animeId: string, episodeNumber: number) {
    // 1. Vérifier que l'anime existe
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // 2. Vérifier que l'épisode existe
    const episode = await this.prisma.inkStreamEpisode.findUnique({
      where: {
        animeId_episodeNumber: {
          animeId,
          episodeNumber,
        },
      },
    });

    if (!episode) {
      throw new NotFoundException('Épisode non trouvé');
    }

    // 3. Consommer 1 MANA via le service Manas
    try {
      const result = await this.manasService.consumeMana(userId, animeId, episodeNumber);
      
      return {
        success: true,
        remainingManas: result.remainingManas,
        anime: {
          id: anime.id,
          title: anime.title,
        },
        episode: {
          number: episodeNumber,
          title: episode.title || `Épisode ${episodeNumber}`,
          videoUrl: episode.videoUrl || '',
          duration: episode.duration || 0,
        },
        watchHistory: {
          createdAt: new Date(),
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Impossible de regarder cet épisode');
    }
  }

  // ============================================
  // AJOUTER UN ANIME EN BASE (DEPUIS ANILIST)
  // ============================================
  async addAnimeFromAnilist(anilistId: string) {
    try {
      const details = await this.movieboxService.getAnimeDetails(anilistId);
      
      if (!details) {
        throw new NotFoundException('Anime non trouvé sur AniList');
      }

      const existing = await this.prisma.inkStreamAnime.findUnique({
        where: { externalId: anilistId },
      });

      if (existing) {
        return existing;
      }

      const anime = await this.prisma.inkStreamAnime.create({
        data: {
          title: details.title,
          description: details.description,
          coverImage: details.coverImage,
          genre: details.genre,
          source: 'anilist',
          externalId: anilistId,
          externalUrl: `https://anilist.co/anime/${anilistId}`,
          rating: details.rating,
          episodesCount: details.episodesCount,
          releaseYear: details.releaseYear || null,
          isActive: true,
        },
      });

      return anime;
    } catch (error) {
      console.error('❌ Erreur ajout anime:', error.message);
      throw new BadRequestException('Impossible d\'ajouter l\'anime');
    }
  }

  // ============================================
  // SYNC DES ÉPISODES D'UN ANIME
  // ============================================
  async syncEpisodes(animeId: string, episodeData: any[]) {
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // Supprimer les anciens épisodes
    await this.prisma.inkStreamEpisode.deleteMany({
      where: { animeId },
    });

    // Ajouter les nouveaux épisodes
    for (const ep of episodeData) {
      await this.prisma.inkStreamEpisode.create({
        data: {
          animeId,
          episodeNumber: ep.episodeNumber,
          title: ep.title || `Épisode ${ep.episodeNumber}`,
          videoUrl: ep.videoUrl || '',
          thumbnail: ep.thumbnail || '',
          duration: ep.duration || 0,
        },
      });
    }

    // Mettre à jour le nombre d'épisodes
    await this.prisma.inkStreamAnime.update({
      where: { id: animeId },
      data: { episodesCount: episodeData.length },
    });

    return { success: true, count: episodeData.length };
  }

  // ============================================
  // RÉCUPÉRER L'HISTORIQUE DE VISIONNAGE D'UN UTILISATEUR
  // ============================================
  async getWatchHistory(userId: string) {
    return this.prisma.inkStreamWatchHistory.findMany({
      where: { userId },
      include: {
        anime: true,
        episode: true,
      },
      orderBy: { lastWatchedAt: 'desc' },
      take: 50,
    });
  }
}
