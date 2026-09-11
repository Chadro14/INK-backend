import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ReelStatus } from '@prisma/client';

@Injectable()
export class ReelSchedulerService {
  private readonly logger = new Logger(ReelSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // PUBLIER LES REELS PROGRAMMÉS
  // ✅ Toutes les minutes
  // ============================================
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledReels() {
    const now = new Date();

    try {
      // Trouver les Reels programmés dont l'heure est arrivée
      const reelsToPublish = await this.prisma.reel.findMany({
        where: {
          status: ReelStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        select: {
          id: true,
          title: true,
          authorId: true,
        },
      });

      if (reelsToPublish.length === 0) return;

      this.logger.log(
        `📢 Publication de ${reelsToPublish.length} Reel(s) programmé(s)`,
      );

      for (const reel of reelsToPublish) {
        try {
          // Mettre à jour le Reel
          await this.prisma.reel.update({
            where: { id: reel.id },
            data: {
              status: ReelStatus.PUBLISHED,
              publishedAt: now,
            },
          });

          // Notification à l'auteur
          await this.prisma.notification.create({
            data: {
              userId: reel.authorId,
              type: 'SYSTEM',
              title: 'Votre Reel est publié',
              body: `"${reel.title}" est maintenant visible`,
              link: `/reels/${reel.id}`,
              metadata: { reelId: reel.id },
            },
          });

          this.logger.log(`✅ Reel publié : ${reel.title}`);
        } catch (error) {
          this.logger.error(`❌ Erreur publication Reel ${reel.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Erreur cron publication Reels programmés:', error);
    }
  }
}
