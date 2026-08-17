// src/modules/security/security.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService } from '../../common/services/email.service'; // ✅ Utiliser le service directement

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [SecurityController],
  providers: [
    SecurityService,
    EmailService, // ✅ Ajouter EmailService dans les providers
  ],
  exports: [SecurityService],
})
export class SecurityModule {}
