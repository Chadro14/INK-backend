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

  // ✅ AJOUTE CETTE MÉTHODE AVEC LA VÉRIFICATION DES 30 JOURS
  async update(id: string, data: { username?: string; email?: string; bio?: string }) {
    // Vérifier si l'utilisateur existe
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // ✅ VÉRIFICATION : Le nom d'utilisateur change-t-il ?
    if (data.username && data.username !== existingUser.username) {
      // Vérifier si le nom est déjà pris
      const usernameTaken = await this.prisma.user.findUnique({
        where: { username: data.username },
      });

      if (usernameTaken) {
        throw new BadRequestException('Ce nom d\'utilisateur est déjà pris');
      }

      // ✅ VÉRIFICATION : 30 jours depuis le dernier changement
      if (existingUser.lastUsernameChange) {
        const daysSinceLastChange = Math.floor(
          (Date.now() - new Date(existingUser.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastChange < 30) {
          throw new BadRequestException(
            `Vous ne pouvez changer votre nom d'utilisateur que tous les 30 jours. Prochain changement possible dans ${30 - daysSinceLastChange} jours.`
          );
        }
      }
    }

    // Mise à jour
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        email: data.email,
        bio: data.bio,
        // ✅ Enregistrer la date du dernier changement de nom
        lastUsernameChange: data.username && data.username !== existingUser.username ? new Date() : existingUser.lastUsernameChange,
      },
    });

    return updatedUser;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}