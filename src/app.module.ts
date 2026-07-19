import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MangasModule } from './modules/mangas/mangas.module';
import { SocialModule } from './modules/social/social.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InkstreamModule } from './modules/inkstream/inkstream.module';
import { FollowModule } from './modules/follow/follow.module';
import { CertificationModule } from './modules/certification/certification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { SteamModule } from './modules/steam/steam.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    MangasModule,
    SocialModule,
    PaymentsModule,
    InkstreamModule,
    FollowModule,
    CertificationModule,
    DashboardModule,
    EventsModule,
    SteamModule,
    ChatModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}