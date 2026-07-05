import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { StorageService } from '../../common/services/storage.service';
import { PDFProcessorService } from '../../common/services/pdf-processor.service';

@Injectable()
export class ChaptersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private pdfProcessor: PDFProcessorService,
  ) {}

  // ============================================
  // CRÉER UN CHAPITRE AVEC PDF
  // ============================================
  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
    file: Express.Multer.File,
  ) {
    // 1. Vérifier que le manga existe et appartient à l'utilisateur
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    // 2. Vérifier que le numéro de chapitre est unique
    const existingChapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: dto.number,
        },
      },
    });

    if (existingChapter) {
      throw new BadRequestException('Ce numéro de chapitre existe déjà');
    }

    // 3. Déterminer si le chapitre est gratuit (1-9 = gratuit)
    const isFree = dto.isFree !== undefined ? dto.isFree : dto.number <= 9;

    // 4. Extraire les informations du PDF
    const pdfInfo = await this.pdfProcessor.extractInfo(file.buffer);
    if (!pdfInfo.isValid) {
      throw new BadRequestException('Le fichier PDF est invalide');
    }

    // 5. Upload du PDF sur R2
    const pdfKey = `manga/${mangaId}/chapter-${dto.number}.pdf`;
    const pdfUrl = await this.storage.upload(pdfKey, file.buffer, 'application/pdf');

    // 6. Extraire la couverture du PDF (première page)
    let coverKey: string | null = null;
    let coverUrl: string | null = null;
    
    try {
      const coverBuffer = await this.pdfProcessor.extractPageAsImage(file.buffer, 0);
      coverKey = `manga/${mangaId}/chapter-${dto.number}-cover.webp`;
      coverUrl = await this.storage.upload(coverKey, coverBuffer, 'image/webp');
    } catch (error) {
      // Si l'extraction échoue, on continue sans couverture
      console.warn('Extraction de couverture échouée:', error.message);
    }

    // 7. Créer le chapitre en base
    const chapter = await this.prisma.chapter.create({
      data: {
        mangaId,
        number: dto.number,
        title: dto.title,
        pdfKey,
        pdfSize: file.size,
        pageCount: pdfInfo.pageCount,
        isFree,
        isDraft: dto.isDraft !== undefined ? dto.isDraft : true,
        price: dto.price || (isFree ? 0 : 0.50),
        coverUrl: coverUrl || null,
        publishedAt: dto.isDraft ? null : new Date(),
      },
    });

    // 8. Si le chapitre est publié, incrémenter le compteur du manga
    if (!dto.isDraft) {
      await this.prisma.manga.update({
        where: { id: mangaId },
        data: {
          // Si c'est un chapitre premium, marquer le manga comme premium
          ...(isFree === false && { isPremium: true }),
        },
      });
    }

    return chapter;
  }

  // ============================================
  // RÉCUPÉRER TOUS LES CHAPITRES D'UN MANGA
  // ============================================
  async findByManga(mangaId: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    return this.prisma.chapter.findMany({
      where: {
        mangaId,
        isDraft: false,
      },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        isFree: true,
        price: true,
        pageCount: true,
        publishedAt: true,
        coverUrl: true,
      },
    });
  }

  // ============================================
  // RÉCUPÉRER UN CHAPITRE PAR SON NUMÉRO
  // ============================================
  async findByNumber(mangaId: string, number: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number,
        },
      },
      include: {
        manga: {
          select: {
            id: true,
            title: true,
            authorId: true,
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                avatarColor: true,
              },
            },
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    if (chapter.isDraft) {
      throw new NotFoundException('Chapitre non disponible');
    }

    // Incrémenter les vues
    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: { viewsCount: { increment: 1 } },
    });

    // Générer une URL signée pour le PDF
    const pdfUrl = await this.storage.getSignedUrl(chapter.pdfKey);

    return {
      ...chapter,
      pdfUrl,
    };
  }

  // ============================================
  // METTRE À JOUR UN CHAPITRE
  // ============================================
  async update(
    mangaId: string,
    number: number,
    userId: string,
    dto: UpdateChapterDto,
  ) {
    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number,
        },
      },
      include: { manga: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    if (chapter.manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    // Si on passe de draft à publié
    const wasDraft = chapter.isDraft;
    const willBePublished = dto.isDraft === false;

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        title: dto.title,
        isFree: dto.isFree,
        isDraft: dto.isDraft,
        price: dto.price,
        publishedAt: willBePublished ? new Date() : chapter.publishedAt,
      },
    });

    // Si le chapitre est publié, mettre à jour le manga
    if (wasDraft && willBePublished) {
      await this.prisma.manga.update({
        where: { id: mangaId },
        data: {
          ...(updated.isFree === false && { isPremium: true }),
        },
      });
    }

    return updated;
  }

  // ============================================
  // SUPPRIMER UN CHAPITRE
  // ============================================
  async delete(mangaId: string, number: number, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number,
        },
      },
      include: { manga: true },
    });

    if (!chapter) {
      throw new NotFoundException('Chapitre non trouvé');
    }

    if (chapter.manga.authorId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce manga');
    }

    // Supprimer le fichier PDF de R2
    await this.storage.delete(chapter.pdfKey);

    // Supprimer le chapitre de la base
    return this.prisma.chapter.delete({
      where: { id: chapter.id },
    });
  }
}