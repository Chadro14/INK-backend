import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // ✅ LOGS - seulement en développement
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      // ✅ SUPPRIME connectionLimit (il ne fonctionne pas ici)
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
