import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MangasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.manga.findMany({
      include: {
        chapters: true,
        author: true,
      },
    });
  }

  async findOne(id: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: {
        chapters: true,
        author: true,
      },
    });

    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    return manga;
  }
}
