import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MangasModule } from './modules/mangas/mangas.module';
import { SocialModule } from './modules/social/social.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InkstreamModule } from './modules/inkstream/inkstream.module';
import { AdminModule } from './modules/admin/admin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FollowModule } from './modules/follow/follow.module';  // ← IMPORT AJOUTÉ
import { PrismaModule } from './prisma/prisma.module';

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
    AdminModule,
    DashboardModule,
    FollowModule,   // ← MODULE AJOUTÉ
  ],
})
export class AppModule {}