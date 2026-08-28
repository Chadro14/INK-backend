// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
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
import { AiModule } from './modules/ai/ai.module';
import { MangaApiModule } from './modules/manga-api/manga-api.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { SecurityModule } from './modules/security/security.module';
import { PremiumModule } from './modules/premium/premium.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ViewsModule } from './modules/views/views.module';
import { ManasModule } from './modules/manas/manas.module';
import { QrModule } from './modules/qr/qr.module';
import { TicketsModule } from './modules/tickets/tickets.module'; // ✅ AJOUTÉ

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
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
    AiModule,
    MangaApiModule,
    CreatorsModule,
    SecurityModule,
    PremiumModule,
    FavoritesModule,
    ViewsModule,
    ManasModule,
    QrModule,
    TicketsModule, // ✅ AJOUTÉ
  ],
})
export class AppModule {}
