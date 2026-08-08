import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import {
  CreateChapterDto,
  ChapterUploadUrlsDto,
  FinalizeChapterDto,
  ChapterMode,
} from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterContentType } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

interface ChapterPage {
  key: string;
  order: number;
  isFree: boolean;
}

@Injectable()
export class ChaptersService {
  private supabase;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    );
  }

  // ============================================
  // 1. GÉNÉRATION DES URLS D'UPLOAD (HYBRIDE / FLEXIBLE)
  // ============================================
  async getChapterUploadUrls(mangaId: string, dto: ChapterUploadUrlsDto) {
    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) throw new NotFoundException('Manga introuvable.');

    // CAS A : Le Frontend envoie un tableau de `filenames`
    if (dto.filenames && dto.filenames.length > 0) {
      return this.generateSignedUploadUrls(mangaId, dto.filenames);
    }

    // CAS B : Le Frontend envoie `mode`, `count`, `chapterNumber`
    const mode = dto.mode || ChapterMode.PHOTOS;
    const count = dto.count || 1;
    const chapterNum = dto.chapterNumber || 1;

    const files = [];
    const pad = (n: number) => String(n).padStart(3, '0');

    for (let i = 0; i < count; i++) {
      const ext = mode === ChapterMode.PDF ? 'pdf' : 'jpg';
      const key = `mangas/${mangaId}/chapters/ch-${chapterNum}/page-${pad(i + 1)}-${Date.now()}.${ext}`;

      const { data, error } = await this.supabase.storage
        .from('chapters')
        .createSignedUploadUrl(key);

      if (error || !data) {
        throw new BadRequestException(
          `Erreur lors de la génération de l'URL pour la page ${i + 1}`,
        );
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/chapters/${key}`;

      files.push({
        filename: `page-${pad(i + 1)}.${ext}`,
        uploadUrl: data.signedUrl,
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
        key: publicUrl,
      });
    }

    return {
      mode,
      files,
    };
  }

  // ============================================
  // 2. FINALISATION DU CHAPITRE
  // ============================================
  async finalizeChapter(mangaId: string, userId: string, dto: FinalizeChapterDto) {
    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) throw new NotFoundException('Manga introuvable.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    const chapterNumber = Number(dto.number);
    const existing = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: chapterNumber,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Le chapitre N°${chapterNumber} existe déjà.`);
    }

    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch {
        freeIndexes = [];
      }
    }

    let calculatedPrice = dto.price ?? 0;
    const isPdfMode = dto.mode === ChapterMode.PDF;

    // Règles de tarification pour le mode photos
    if (!isPdfMode) {
      const totalPages = dto.keys.length;
      const paidPagesCount = totalPages - freeIndexes.length;

      if (paidPagesCount > 2) {
        throw new BadRequestException(
          `Un chapitre en mode photos ne peut contenir que 2 pages payantes maximum. (Actuellement: ${paidPagesCount})`,
        );
      }

      calculatedPrice = paidPagesCount > 0 ? paidPagesCount * 0.55 : 0;
    }

    const isDraft = dto.isDraft ?? false;

    if (isPdfMode) {
      return this.prisma.chapter.create({
        data: {
          mangaId,
          number: chapterNumber,
          title: dto.title?.trim() || null,
          contentType: ChapterContentType.PDF,
          pdfKey: dto.keys[0],
          isFree: calculatedPrice === 0,
          price: calculatedPrice,
          isDraft,
          publishedAt: !isDraft ? new Date() : null,
        },
      });
    }

    const pages: ChapterPage[] = dto.keys.map((key, i) => ({
      key,
      order: i + 1,
      isFree: freeIndexes.includes(i),
    }));

    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: chapterNumber,
        title: dto.title?.trim() || null,
        contentType: ChapterContentType.IMAGES,
        pages: pages as any,
        pageCount: pages.length,
        isFree: calculatedPrice === 0,
        price: calculatedPrice,
        isDraft,
        publishedAt: !isDraft ? new Date() : null,
      },
    });
  }

  // Helper pour la génération par tableau de filenames
  async generateSignedUploadUrls(mangaId: string, filenames: string[]) {
    const results = await Promise.all(
      filenames.map(async (filename) => {
        const fileExt = filename.split('.').pop();
        const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const key = `mangas/${mangaId}/chapters/${cleanFileName}`;

        const { data, error } = await this.supabase.storage
          .from('chapters')
          .createSignedUploadUrl(key);

        if (error || !data) {
          throw new BadRequestException(`Erreur lors de la génération de l'URL pour ${filename}`);
        }

        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/chapters/${key}`;

        return {
          filename,
          uploadUrl: data.signedUrl,
          signedUrl: data.signedUrl,
          path: data.path,
          token: data.token,
          key: publicUrl,
        };
      }),
    );

    return results;
  }

  // ============================================
  // 3. ANCIENNE MÉTHODE DE CRÉATION CLASSIQUE
  // ============================================
  async create(mangaId: string, userId: string, dto: CreateChapterDto) {
    if (!dto.pdfUrl && (!dto.imagesUrls || dto.imagesUrls.length === 0)) {
      throw new BadRequestException('Fournissez un fichier PDF ou au moins une image.');
    }

    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) throw new NotFoundException('Manga non trouvé.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    const chapterNumber = Number(dto.number);
    const existing = await this.prisma.chapter.findUnique({
      where: { mangaId_number: { mangaId, number: chapterNumber } },
    });

    if (existing) {
      throw new BadRequestException(`Le chapitre N°${chapterNumber} existe déjà pour ce manga.`);
    }

    const isDraft = dto.isDraft ?? false;

    if (dto.pdfUrl) {
      return this.prisma.chapter.create({
        data: {
          mangaId,
          number: chapterNumber,
          title: dto.title?.trim() || null,
          contentType: ChapterContentType.PDF,
          pdfKey: dto.pdfUrl,
          isFree: dto.isFree ?? true,
          isDraft,
          price: dto.isFree ? 0 : (dto.price || 0),
          coverUrl: dto.coverUrl || null,
          publishedAt: !isDraft ? new Date() : null,
        },
      });
    }

    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch {
        freeIndexes = [];
      }
    }

    const pages: ChapterPage[] = (dto.imagesUrls || []).map((urlOrKey, i) => ({
      key: urlOrKey,
      order: i + 1,
      isFree: freeIndexes.includes(i),
    }));

    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: chapterNumber,
        title: dto.title?.trim() || null,
        contentType: ChapterContentType.IMAGES,
        pages: pages as any,
        pageCount: pages.length,
        isFree: dto.isFree ?? true,
        isDraft,
        price: dto.isFree ? 0 : (dto.price || 0),
        coverUrl: dto.coverUrl || null,
        publishedAt: !isDraft ? new Date() : null,
      },
    });
  }

  // ============================================
  // 4. MISE À JOUR ET LECTURE
  // ============================================
  async update(chapterId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    const willBePublished = dto.isDraft === false && chapter.isDraft === true;

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        title: dto.title,
        isFree: dto.isFree,
        isDraft: dto.isDraft,
        price: dto.price,
        publishedAt: willBePublished ? new Date() : chapter.publishedAt,
      },
    });
  }

  async findOne(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    return this.attachSignedUrls(chapter);
  }

  async findByNumber(mangaId: string, number: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: Number(number),
        },
      },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    return this.attachSignedUrls(chapter);
  }

  async findByManga(mangaId: string) {
    return this.prisma.chapter.findMany({
      where: { mangaId, isDraft: false },
      orderBy: { number: 'asc' },
    });
  }

  private async attachSignedUrls(chapter: any) {
    if (chapter.contentType === ChapterContentType.PDF && chapter.pdfKey) {
      const isFullUrl = chapter.pdfKey.startsWith('http://') || chapter.pdfKey.startsWith('https://');
      const pdfUrl = isFullUrl ? chapter.pdfKey : await this.storage.getSignedUrl(chapter.pdfKey);
      return { ...chapter, pdfUrl };
    }

    if (chapter.contentType === ChapterContentType.IMAGES && Array.isArray(chapter.pages)) {
      const pagesWithUrls = await Promise.all(
        (chapter.pages as unknown as ChapterPage[]).map(async (page) => {
          const isFullUrl = page.key.startsWith('http://') || page.key.startsWith('https://');
          return {
            order: page.order,
            isFree: page.isFree,
            url: isFullUrl ? page.key : await this.storage.getSignedUrl(page.key),
          };
        }),
      );
      return { ...chapter, pages: pagesWithUrls };
    }

    return chapter;
  }

  async delete(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    if (chapter.pdfKey && !chapter.pdfKey.startsWith('http')) {
      await this.storage.delete(chapter.pdfKey);
    }

    if (Array.isArray(chapter.pages)) {
      await Promise.all(
        (chapter.pages as unknown as ChapterPage[])
          .filter((p) => p.key && !p.key.startsWith('http'))
          .map((p) => this.storage.delete(p.key)),
      );
    }

    await this.prisma.chapter.delete({
      where: { id: chapterId },
    });

    return { message: 'Chapitre supprimé avec succès.' };
  }
}
