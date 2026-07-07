import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ManasService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // 1. OBTENIR LE SOLDE DE MANAS D'UN UTILISATEUR
  // ============================================
  async getBalance(userId: string): Promise<{ manas: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return { manas: user.manas };
  }

  // ============================================
  // 2. VÉRIFIER SI L'UTILISATEUR PEUT REGARDER UN ÉPISODE
  // ============================================
  async canWatchEpisode(userId: string, animeId: string, episodeNumber: number): Promise<{ canWatch: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      return { canWatch: false, reason: 'Utilisateur non trouvé' };
    }

    // Les utilisateurs Premium ont un accès illimité
    if (user.premiumActive) {
      return { canWatch: true };
    }

    // Vérifier si l'utilisateur a assez de MANAS
    if (user.manas > 0) {
      return { canWatch: true };
    }

    return { canWatch: false, reason: 'MANAS insuffisants' };
  }

  // ============================================
  // 3. CONSOMMER UN MANA POUR REGARDER UN ÉPISODE
  // ============================================
  async consumeMana(userId: string, animeId: string, episodeNumber: number): Promise<{ success: boolean; remainingManas: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { manas: true, premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Les utilisateurs Premium ne consomment pas de MANAS
    if (user.premiumActive) {
      return { success: true, remainingManas: user.manas };
    }

    if (user.manas <= 0) {
      throw new BadRequestException('MANAS insuffisants');
    }

    // Consommer 1 MANA
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { manas: { decrement: 1 } },
    });

    // Enregistrer l'historique de visionnage
    await this.prisma.inkStreamWatchHistory.create({
      data: {
        userId,
        animeId,
        episodeNumber,
        progress: 0,
      },
    });

    return {
      success: true,
      remainingManas: updatedUser.manas,
    };
  }

  // ============================================
  // 4. AJOUTER DES MANAS (PARRAINAGE)
  // ============================================
  async addManas(userId: string, amount: number, reason: string): Promise<{ manas: number }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { manas: { increment: amount } },
    });

    // Log de l'ajout
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'MANA_ADDED',
        details: { amount, reason },
      },
    });

    return { manas: user.manas };
  }
}