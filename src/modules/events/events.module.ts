import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventSchedulerService } from './event-scheduler.service';
import { EventVotingService } from './event-voting.service';
import { EventRewardsService } from './event-rewards.service';
import { EventRankingService } from './event-ranking.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManasModule } from '../manas/manas.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    ManasModule,
    TicketsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    EventSchedulerService,
    EventVotingService,
    EventRewardsService,
    EventRankingService,
  ],
  exports: [
    EventsService,
    EventSchedulerService,
    EventVotingService,
    EventRewardsService,
    EventRankingService,
  ],
})
export class EventsModule {}
