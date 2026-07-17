import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import * as sharp from 'sharp';

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ============================================
  // CRÉER UN CHAPITRE (upload PDF + couverture optionnelle)
  // ============================================
  async create(
    dto: CreateChapterDto,
    file: Express.Multer.File,
    coverFile?: Express.Multer.File,
  ) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: dto.mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    const existing = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId: dto.mangaId,
          number: dto.number,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Ce numéro de chapitre existe déjà pour ce manga');
    }

    const pdfKey = `${dto.mangaId}/chapter-${dto.number}-${Date.now()}.pdf`;
    await this.storage.upload(pdfKey, file.buffer, 'application/pdf');

    let coverUrl: string | undefined;
    if (coverFile) {
      const coverBuffer = await sharp(coverFile.buffer)
        .resize(600, 850, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

      const coverKey = `${dto.mangaId}/cover-chapter-${dto.number}-${Date.now()}.webp`;
      coverUrl = await this.storage.upload(coverKey, coverBuffer, 'image/webp');
    }

    const chapter = await this.prisma.chapter.create({
      data: {
        mangaId: dto.mangaId,
        number: dto.number,
        title: dto.title,
        pdfKey,
        pdfSize: file.size,
        isFree: dto.isFree ?? false,
        isDraft: dto.isDraft ?? true,
        price: dto.price,
        coverUrl,
        publishedAt: dto.isDraft === false ? new Date() : null,
      },
    });

    return chapter;
  }

  // ============================================
  // METTRE À JOUR UN CHAPITRE
  // ============================================
  async update(chapterId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
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

  // ============================================
  // RÉCUPÉRER UN CHAPITRE (avec URL signée du PDF)
  // ============================================
  async findOne(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    const pdfUrl = await this.storage.getSignedUrl(chapter.pdfKey);

    return { ...chapter, pdfUrl };
  }

  // ============================================
  // RÉCUPÉRER LES CHAPITRES D'UN MANGA
  // ============================================
  async findByManga(mangaId: string) {
    return this.prisma.chapter.findMany({
      where: { mangaId, isDraft: false },
      orderBy: { number: 'asc' },
    });
  }

  // ============================================
  // SUPPRIMER UN CHAPITRE
  // ============================================
  async delete(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    await this.storage.delete(chapter.pdfKey);

    await this.prisma.chapter.delete({
      where: { id: chapterId },
    });

    return { message: 'Chapitre supprimé avec succès' };
  }
}