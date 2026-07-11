import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - IMPORTANT pour Vercel
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Préfixe global /api
  app.setGlobalPrefix('api');

  return app;
}

// Pour le développement local seulement
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  bootstrap().then(async (app) => {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 INKDROP API running on http://localhost:${port}/api`);
  });
}