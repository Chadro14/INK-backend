import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
  // GESTION DE LA CERTIFICATION & DU BADGE
  // ============================================

  // 1. Modifier la couleur du badge (Utilisateur certifié uniquement)
  async updateBadgeColor(userId: string, badgeColor: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.isCertified) {
      throw new ForbiddenException('Seuls les utilisateurs certifiés peuvent personnaliser leur badge');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { badgeColor },
    });
  }

  // 2. Accorder ou retirer la certification (Admin)
  async setCertification(targetUserId: string, isCertified: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isCertified },
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
