import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR ID
  // ============================================
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        mangas: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR EMAIL
  // ============================================
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // ============================================
  // RÉCUPÉRER UN UTILISATEUR PAR USERNAME
  // ============================================
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        mangas: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  // ============================================
  // METTRE À JOUR UN UTILISATEUR
  // ============================================
  async update(userId: string, data: { username?: string; email?: string; bio?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return user;
  }

  // ============================================
  // METTRE À JOUR L'AVATAR
  // ============================================
  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  // ============================================
  // SUPPRIMER UN UTILISATEUR
  // ============================================
  async delete(userId: string) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}
