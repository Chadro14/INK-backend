// src/modules/security/security.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt'; // ✅ AJOUTER CET IMPORT
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../common/services/email.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
