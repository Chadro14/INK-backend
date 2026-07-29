import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
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

  // 1. Génération des URLs signées pour upload direct Supabase
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
          key: publicUrl,
        };
      }),
    );

    return results;
  }

  // 2. Enregistrement des données du chapitre en BDD
  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
  ) {
    if (!dto.pdfUrl && (!dto.imagesUrls || dto.imagesUrls.length === 0)) {
      throw new BadRequestException('Fournissez un fichier PDF ou au moins une image.');
    }

    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé.');
    }

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
      throw new BadRequestException(`Le chapitre N°${chapterNumber} existe déjà pour ce manga.`);
    }

    const coverUrl = dto.coverUrl || null;
    const isDraft = dto.isDraft ?? false;

    // CAS 1 : PDF
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
          coverUrl,
          publishedAt: !isDraft ? new Date() : null,
        },
      });
    }

    // CAS 2 : IMAGES
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
        coverUrl,
        publishedAt: !isDraft ? new Date() : null,
      },
    });
  }

  async update(chapterId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé.');
    }

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

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé.');
    }

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

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé.');
    }

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

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé.');
    }

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
