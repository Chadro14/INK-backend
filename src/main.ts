import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Déverrouiller le CORS en dev (autorise localhost ET 127.0.0.1 sur n'importe quel port)
  app.enableCors({
    origin: true, // Autorise toutes les origines dynamiquement en dev
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 2. Écouter explicitement sur '0.0.0.0' pour être joignable en IPv4
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
