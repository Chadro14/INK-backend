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
import sharp from 'sharp';
// @ts-ignore
import pdfParse from 'pdf-parse';

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ============================================
  // CRÉER UN CHAPITRE (upload PDF ou Images)
  // ============================================
  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
    pdfFile?: Express.Multer.File,
    imageFiles?: Express.Multer.File[],
    coverFile?: Express.Multer.File,
  ) {
    // 1. On exige soit un PDF, soit des images
    if (!pdfFile && (!imageFiles || imageFiles.length === 0)) {
      throw new BadRequestException('Fournissez un PDF ou des images.');
    }

    // 2. Vérif PDF (min 10 pages)
    if (pdfFile && pdfFile.buffer) {
      try {
        const pdfData = await pdfParse(pdfFile.buffer);
        if (pdfData.numpages < 10) {
          throw new BadRequestException(`Le PDF doit avoir au moins 10 pages (Actuel: ${pdfData.numpages}).`);
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    // 3. Vérif Images (min 10 images)
    if (imageFiles && imageFiles.length > 0) {
      if (imageFiles.length < 10) {
        throw new BadRequestException(`Il faut au moins 10 images (Actuel: ${imageFiles.length}).`);
      }
    }

    const manga = await this.prisma.manga.findUnique({ where: { id: mangaId } });
    if (!manga) throw new NotFoundException('Manga non trouvé');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga");
    }

    const existing = await this.prisma.chapter.findUnique({
      where: { mangaId_number: { mangaId, number: dto.number } },
    });
    if (existing) throw new BadRequestException('Ce numéro de chapitre existe déjà.');

    // 4. Upload (PDF ou Images)
    let pdfKey: string | null = null;
    let pdfSize: number = 0;
    const pagesKeys: string[] = [];

    if (pdfFile) {
      pdfKey = `${mangaId}/chapter-${dto.number}-${Date.now()}.pdf`;
      await this.storage.upload(pdfKey, pdfFile.buffer, 'application/pdf');
      pdfSize = pdfFile.size;
    } else if (imageFiles) {
      for (let i = 0; i < imageFiles.length; i++) {
        const imgKey = `${mangaId}/chapter-${dto.number}-page-${i + 1}-${Date.now()}.webp`;
        const imgBuffer = await sharp(imageFiles[i].buffer).webp({ quality: 85 }).toBuffer();
        await this.storage.upload(imgKey, imgBuffer, 'image/webp');
        pagesKeys.push(imgKey);
      }
    }

    let coverUrl: string | undefined;
    if (coverFile) {
      const coverBuffer = await sharp(coverFile.buffer).resize(600, 850, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      const coverKey = `${mangaId}/cover-chapter-${dto.number}-${Date.now()}.webp`;
      coverUrl = await this.storage.upload(coverKey, coverBuffer, 'image/webp');
    }

    // 5. Création DB
    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: dto.number,
        title: dto.title,
        pdfKey: pdfKey,      // Sera null si on utilise des images
        pages: pagesKeys,    // NOUVEAU: Stocke le tableau d'images
        pdfSize: pdfSize,
        isFree: dto.isFree ?? false,
        isDraft: dto.isDraft ?? true,
        price: dto.price,
        coverUrl,
        publishedAt: dto.isDraft === false ? new Date() : null,
      },
    });
  }

  // ... (Le reste de ton code update, findOne, findByManga, delete reste inchangé) ...
}
