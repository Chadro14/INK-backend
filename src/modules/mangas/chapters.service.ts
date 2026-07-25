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
        // CORRECTION ICI : on force TypeScript à accepter la comparaison
        isFree: dto.isFree === true || (dto.isFree as any) === 'true',
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
