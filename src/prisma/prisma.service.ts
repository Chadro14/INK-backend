import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // ✅ CONFIGURATION AVEC LOGS ET LIMITE DE CONNEXIONS
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      // ✅ LIMITER LE NOMBRE DE CONNEXIONS POUR ÉVITER EMAXCONN
      connectionLimit: 10,
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connecté à la base de données');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma déconnecté de la base de données');
  }
}
