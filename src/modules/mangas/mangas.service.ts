import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajuste le chemin selon ton dossier PrismaService

@Injectable()
export class MangasService {
  constructor(private readonly prisma: PrismaService) {}

  // Créer un manga
  async create(data: any) {
    return this.prisma.manga.create({
      data,
    });
  }

  // Récupérer tous les mangas (avec le nombre de chapitres et les infos de l'auteur)
  async findAll() {
    return this.prisma.manga.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Récupérer un manga par son UUID
  async findOne(id: string) {
    const manga = await this.prisma.manga.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            isCertified: true,
          },
        },
        chapters: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!manga) {
      throw new NotFoundException(`Aucun manga trouvé avec l'UUID "${id}".`);
    }

    return manga;
  }

  // Mettre à jour un manga
  async update(id: string, data: any) {
    // On s'assure d'abord qu'il existe
    await this.findOne(id);

    return this.prisma.manga.update({
      where: { id },
      data,
    });
  }

  // Supprimer un manga
  async remove(id: string) {
    // On s'assure d'abord qu'il existe
    await this.findOne(id);

    return this.prisma.manga.delete({
      where: { id },
    });
  }
}
