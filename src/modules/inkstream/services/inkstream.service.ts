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
  // RECHERCHER DES ANIMES (AVEC FALLBACK)
  // ============================================
  async searchAnimes(dto: SearchAnimeDto) {
    const { q, page = 1, limit = 20, genre, source } = dto;
    const skip = (page - 1) * limit;

    // 1. Recherche AniList
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

    // 2. Recherche par genre
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

    // 3. Fallback : Base de données
    const where: any = {};
    if (q) where.title = { contains: q, mode: 'insensitive' };
    if (genre) where.genre = { has: genre };
    if (source) where.source = source;

    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where,
      skip,
      take: limit,
      orderBy: { rating: 'desc' },
    });

    // 4. Fallback : Tendances AniList
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
    // 1. Vérifier en base
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id },
      include: { episodes: true },
    });

    if (anime) {
      return anime;
    }

    // 2. Chercher sur AniList
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
    // 1. Base de données
    const dbAnimes = await this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 10,
    });

    if (dbAnimes.length > 0) {
      return dbAnimes;
    }

    // 2. AniList
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

    return this.prisma.inkStreamAnime.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
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

    return this.prisma.inkStreamAnime.findMany({
      where: { genre: { has: genre } },
      take: limit,
    });
  }

  // ============================================
  // ✅ REGARDER UN ÉPISODE (AVEC DOUBLE API DE STREAMING)
  // ============================================
  async watchEpisode(userId: string, animeId: string, episodeNumber: number) {
    // 1. Vérifier l'anime
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // 2. Vérifier l'épisode
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

    // 3. Consommer 1 MANA
    let remainingManas = 0;
    try {
      const result = await this.manasService.consumeMana(userId, animeId, episodeNumber);
      remainingManas = result.remainingManas;
    } catch (error) {
      throw new BadRequestException(error.message || 'MANAS insuffisants');
    }

    // 4. ✅ RÉCUPÉRER LE LIEN DE STREAMING (DOUBLE API)
    let streamUrl = '';

    // API 1 : Consumet (Gogoanime, Zoro, etc.)
    try {
      streamUrl = await this.movieboxService.getEpisodeStreamFromConsumet(
        anime.externalId || animeId,
        episodeNumber
      );
    } catch (error) {
      console.warn('⚠️ Consumet stream failed:', error.message);
    }

    // API 2 : Fallback sur MovieBox (si Consumet échoue)
    if (!streamUrl) {
      try {
        streamUrl = await this.movieboxService.getEpisodeStreamFromMovieBox(
          anime.externalId || animeId,
          episodeNumber
        );
      } catch (error) {
        console.warn('⚠️ MovieBox stream failed:', error.message);
      }
    }

    // 5. Si aucune API ne donne de lien
    if (!streamUrl) {
      return {
        success: true,
        remainingManas,
        anime: {
          id: anime.id,
          title: anime.title,
        },
        episode: {
          number: episodeNumber,
          title: episode.title || `Épisode ${episodeNumber}`,
          videoUrl: '',
          duration: episode.duration || 0,
        },
        watchHistory: {
          createdAt: new Date(),
        },
        error: 'Aucune source de streaming disponible pour cet épisode.',
      };
    }

    // 6. Retourner le lien de streaming
    return {
      success: true,
      remainingManas,
      anime: {
        id: anime.id,
        title: anime.title,
      },
      episode: {
        number: episodeNumber,
        title: episode.title || `Épisode ${episodeNumber}`,
        videoUrl: streamUrl, // ✅ LIEN DE STREAMING
        duration: episode.duration || 0,
      },
      watchHistory: {
        createdAt: new Date(),
      },
    };
  }

  // ============================================
  // AJOUTER UN ANIME EN BASE
  // ============================================
  async addAnimeFromAnilist(anilistId: string) {
    try {
      const details = await this.movieboxService.getAnimeDetails(anilistId);
      
      if (!details) {
        throw new NotFoundException('Anime non trouvé sur AniList');
      }

      const existing = await this.prisma.inkStreamAnime.findUnique({
        where: {
          source_externalId: {
            source: 'anilist',
            externalId: anilistId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      const anime = await this.prisma.inkStreamAnime.create({
        data: {
          title: details.title,
          description: details.description || '',
          coverImage: details.coverImage || '',
          genre: details.genre || [],
          source: 'anilist',
          externalId: anilistId,
          externalUrl: `https://anilist.co/anime/${anilistId}`,
          rating: details.rating || 0,
          episodesCount: details.episodesCount || 0,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });

      return anime;
    } catch (error) {
      console.error('❌ Erreur ajout anime:', error.message);
      throw new BadRequestException('Impossible d\'ajouter l\'anime');
    }
  }

  // ============================================
  // SYNC DES ÉPISODES
  // ============================================
  async syncEpisodes(animeId: string, episodeData: any[]) {
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    await this.prisma.inkStreamEpisode.deleteMany({
      where: { animeId },
    });

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

    await this.prisma.inkStreamAnime.update({
      where: { id: animeId },
      data: { 
        episodesCount: episodeData.length,
        lastSyncAt: new Date(),
      },
    });

    return { success: true, count: episodeData.length };
  }

  // ============================================
  // HISTORIQUE DE VISIONNAGE
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
