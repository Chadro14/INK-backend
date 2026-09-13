import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CollaborationService } from './collaboration.service';

@Injectable()
export class CollaborationCron {
  private readonly logger = new Logger(CollaborationCron.name);

  constructor(private readonly service: CollaborationService) {}

  // Tourne toutes les heures
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredRequests() {
    try {
      const result = await this.service.expireOldRequests();
      if (result.expired > 0) {
        this.logger.log(`${result.expired} demande(s) expirée(s) traitée(s)`);
      }
    } catch (err) {
      this.logger.error('Erreur cron expiration:', err);
    }
  }
}
