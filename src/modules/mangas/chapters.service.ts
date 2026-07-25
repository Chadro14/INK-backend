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
    // ⚠️ INSÈRE ICI TA LOGIQUE D'UPLOAD (Supabase, Sharp, etc.) que tu avais déjà.
    
    // Exemple de sauvegarde dans la base de données :
    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: Number(dto.number),
        title: dto.title,
        price: dto.price ? Number(dto.price) : null,
        isFree: dto.isFree === 'true' || dto.isFree === true,
        // Ajoute ici pdfKey, pages, coverUrl une fois tes fichiers uploadés
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
