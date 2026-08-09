import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MangasModule } from './modules/mangas/mangas.module';
import { SocialModule } from './modules/social/social.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InkstreamModule } from './modules/inkstream/inkstream.module';
import { FollowModule } from './modules/follow/follow.module';
import { CertificationModule } from './modules/certification/certification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SteamModule } from './modules/steam/steam.module';
import { EventsModule } from './modules/events/events.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { BootstrapModule } from './modules/admin/bootstrap.module';
import { AiModule } from './modules/ai/ai.module'; // ✅ AJOUT

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
    ChatModule,
    NotificationsModule,
    SteamModule,
    EventsModule,
    AdminModule,
    BootstrapModule,
    AiModule, // ✅ AJOUT
  ],
})
export class AppModule {}
