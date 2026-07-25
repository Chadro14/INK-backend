import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
    pdfFile?: any,
    imageFiles?: any[],
    coverFile?: any
  ) {
    // 1. Déterminer le type de contenu
    const contentType = imageFiles && imageFiles.length > 0 ? 'IMAGES' : 'PDF';

    // 2. Récupérer et transformer les index des pages gratuites (ex: "[0,1,2]" -> [0, 1, 2])
    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch (e) {
        console.error('Erreur de parsing des freePageIndexes', e);
      }
    }

    // 3. Construction des données de pages et d'upload
    let pagesJson: any[] = [];
    let pageCount = 0;
    let pdfKey = null;
    let pdfSize = null;

    // ⚠️ INSÈRE ICI TA LOGIQUE D'UPLOAD (Supabase, Sharp, etc.)
    // Tu dois uploader tes fichiers ICI avant de remplir les variables ci-dessous.

    if (contentType === 'IMAGES' && imageFiles) {
      pageCount = imageFiles.length;
      
      pagesJson = imageFiles.map((file, index) => {
        // ⚠️ Remplace ceci par l'URL ou la clé renvoyée par ton service d'upload (ex: Supabase)
        const uploadedFileKey = `chemin_vers_ton_stockage/${Date.now()}_${file.originalname}`;

        return {
          key: uploadedFileKey, // L'URL ou la clé de l'image
          order: index,         // L'ordre de l'image
          isFree: freeIndexes.includes(index), // true si l'index est dans freePageIndexes
        };
      });
    } else if (contentType === 'PDF' && pdfFile) {
      pageCount = 1; // Ou extraire le vrai nombre de pages du PDF si tu as un outil pour ça
      pdfSize = pdfFile.size;
      // ⚠️ Remplace ceci par l'URL ou la clé renvoyée par ton upload PDF
      pdfKey = `chemin_vers_ton_stockage_pdf/${Date.now()}_${pdfFile.originalname}`; 
    }

    // 4. Enregistrement en base de données
    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: Number(dto.number),
        title: dto.title,
        price: dto.price ? Number(dto.price) : null,
        isFree: dto.isFree === true || (dto.isFree as any) === 'true',
        isDraft: dto.isDraft === true || (dto.isDraft as any) === 'true',
        contentType: contentType,
        pages: pagesJson,
        pageCount,
        pdfKey,
        pdfSize,
      },
    });
  }

  async findByManga(mangaId: string) {
    return this.prisma.chapter.findMany({
      where: { mangaId },
      orderBy: { number: 'asc' },
    });
  }

  async findByNumber(mangaId: string, number: number) {
    return this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: Number(number),
        },
      },
    });
  }
}
