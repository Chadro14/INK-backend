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

interface ChapterPage {
  key: string;
  order: number;
  isFree: boolean;
}

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
  ) {
    // 1. Validation : PDF ou au moins une image obligatoire
    if (!dto.pdfUrl && (!dto.imagesUrls || dto.imagesUrls.length === 0)) {
      throw new BadRequestException('Fournissez un fichier PDF ou au moins une image.');
    }

    // 2. Vérification de l'existence du manga
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé.');
    }

    // 3. Vérification des droits d'auteur
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    // 4. Vérification d'unicité du numéro de chapitre
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

    // --- CAS 1 : FORMAT PDF ---
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

    // --- CAS 2 : FORMAT IMAGES ---
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
