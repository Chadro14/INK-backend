import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. ACTIVER EXPLICITEMENT LES CORS (Indispensable !)
  app.enableCors({
    origin: true, // Autorise toutes les origines (ou l'URL de ton frontend Next.js)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 2. PIPES DE VALIDATION
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. ECOUTE SUR LE PORT ET BINDING GLOBAL 0.0.0.0
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Serveur démarré sur le port ${port}`);
}
bootstrap();
