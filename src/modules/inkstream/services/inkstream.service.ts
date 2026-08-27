// src/modules/inkstream/services/inkstream.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  // RÉCUPÉRER UN ANIME PAR ID (AVEC ÉPISODES FICTIFS)
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
          // ✅ CRÉER DES ÉPISODES FICTIFS POUR L'AFFICHAGE
          const totalEpisodes = anilistAnime.episodesCount || 12;
          const episodes = [];
          for (let i = 1; i <= Math.min(totalEpisodes, 50); i++) {
            episodes.push({
              id: `ep-${i}`,
              episodeNumber: i,
              title: `Épisode ${i}`,
              duration: 24,
            });
          }
          
          return {
            ...anilistAnime,
            episodes: episodes,
          };
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
  // ✅ RÉCUPÉRER LA VIDÉO D'UN ÉPISODE (SANS MANAS)
  // ============================================
  async getEpisodeVideoOnly(animeId: string, episodeNumber: number) {
    // 1. Vérifier l'anime
    const anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // 2. Vérifier l'épisode
    let episode = await this.prisma.inkStreamEpisode.findUnique({
      where: {
        animeId_episodeNumber: {
          animeId,
          episodeNumber,
        },
      },
    });

    // 3. Si l'épisode n'existe pas en base, le créer
    if (!episode) {
      episode = await this.prisma.inkStreamEpisode.create({
        data: {
          animeId,
          episodeNumber,
          title: `Épisode ${episodeNumber}`,
          videoUrl: '',
          isAvailable: true,
        },
      });
    }

    // 4. Récupérer le lien de streaming
    const videoResult = await this.movieboxService.getEpisodeVideo(
      anime.externalId || animeId,
      episodeNumber
    );

    // 5. Mettre à jour l'épisode avec le lien trouvé
    if (videoResult.url) {
      await this.prisma.inkStreamEpisode.update({
        where: { id: episode.id },
        data: { videoUrl: videoResult.url },
      });
    }

    return {
      success: !!videoResult.url,
      anime: {
        id: anime.id,
        title: anime.title,
      },
      episode: {
        number: episodeNumber,
        title: episode.title || `Épisode ${episodeNumber}`,
        videoUrl: videoResult.url || '',
        source: videoResult.source || 'none',
      },
      message: videoResult.url ? 'Vidéo trouvée' : 'Aucune source disponible',
    };
  }

  // ============================================
  // ✅ REGARDER UN ÉPISODE (AVEC MANAS) - CORRIGÉ
  // ============================================
  async watchEpisode(userId: string, animeId: string, episodeNumber: number) {
    // 1. Vérifier l'anime en base
    let anime = await this.prisma.inkStreamAnime.findUnique({
      where: { id: animeId },
    });

    // 2. Si l'anime n'est pas en base, le chercher sur AniList et le créer
    if (!anime) {
      const isNumeric = /^\d+$/.test(animeId);
      if (isNumeric) {
        try {
          const anilistAnime = await this.movieboxService.getAnimeDetails(animeId);
          if (anilistAnime) {
            // Créer l'anime en base
            anime = await this.prisma.inkStreamAnime.create({
              data: {
                title: anilistAnime.title,
                description: anilistAnime.description || '',
                coverImage: anilistAnime.coverImage || '',
                genre: anilistAnime.genre || [],
                source: 'anilist',
                externalId: animeId,
                externalUrl: `https://anilist.co/anime/${animeId}`,
                rating: anilistAnime.rating || 0,
                episodesCount: anilistAnime.episodesCount || 0,
                isActive: true,
                lastSyncAt: new Date(),
              },
            });
            console.log(`✅ Anime "${anilistAnime.title}" créé en base avec ID ${anime.id}`);
          }
        } catch (error) {
          console.warn('⚠️ Erreur récupération AniList:', error.message);
        }
      }
    }

    if (!anime) {
      throw new NotFoundException('Anime non trouvé');
    }

    // 2. Vérifier l'épisode
    let episode = await this.prisma.inkStreamEpisode.findUnique({
      where: {
        animeId_episodeNumber: {
          animeId: anime.id,
          episodeNumber,
        },
      },
    });

    // 3. Si l'épisode n'existe pas, le créer
    if (!episode) {
      episode = await this.prisma.inkStreamEpisode.create({
        data: {
          animeId: anime.id,
          episodeNumber,
          title: `Épisode ${episodeNumber}`,
          videoUrl: '',
          isAvailable: true,
        },
      });
    }

    // 4. Consommer 1 MANA
    let remainingManas = 0;
    try {
      const result = await this.manasService.consumeMana(userId, anime.id, episodeNumber);
      remainingManas = result.remainingManas;
    } catch (error) {
      throw new BadRequestException(error.message || 'MANAS insuffisants');
    }

    // 5. Récupérer le lien de streaming
    const videoResult = await this.movieboxService.getEpisodeVideo(
      anime.externalId || anime.id,
      episodeNumber
    );

    // 6. Mettre à jour l'épisode si un lien est trouvé
    if (videoResult.url) {
      await this.prisma.inkStreamEpisode.update({
        where: { id: episode.id },
        data: { videoUrl: videoResult.url },
      });
    }

    // 7. Créer/mettre à jour l'historique de visionnage
    const watchHistory = await this.prisma.inkStreamWatchHistory.upsert({
      where: {
        userId_episodeId: {
          userId,
          episodeId: episode.id,
        },
      },
      update: {
        lastWatchedAt: new Date(),
        progress: 0,
      },
      create: {
        userId,
        episodeId: episode.id,
        animeId: anime.id,
        progress: 0,
      },
    });

    // 8. Retourner le résultat
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
        videoUrl: videoResult.url || '',
        source: videoResult.source || 'none',
        duration: episode.duration || 0,
      },
      watchHistory: {
        id: watchHistory.id,
        progress: 0,
        createdAt: new Date(),
        lastWatchedAt: watchHistory.lastWatchedAt,
      },
      message: videoResult.url ? 'Lecture en cours' : 'Aucune source disponible pour cet épisode',
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
