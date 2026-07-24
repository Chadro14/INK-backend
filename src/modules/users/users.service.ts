import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  // ✅ AJOUTE CETTE MÉTHODE
  async update(id: string, data: { username?: string; email?: string; bio?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier si le nom d'utilisateur change
    if (data.username && data.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: data.username },
      });
      if (existing) {
        throw new BadRequestException('Ce nom d\'utilisateur est déjà pris');
      }

      // Vérification des 30 jours
      if (user.lastUsernameChange) {
        const daysSinceLastChange = Math.floor(
          (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastChange < 30) {
          throw new BadRequestException(
            `Vous ne pouvez changer votre nom que tous les 30 jours. Prochain changement dans ${30 - daysSinceLastChange} jours.`
          );
        }
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        email: data.email,
        bio: data.bio,
        lastUsernameChange: data.username && data.username !== user.username ? new Date() : user.lastUsernameChange,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}