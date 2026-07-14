import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from '../src/app.module';

const expressApp = express();
let cachedApp: express.Express | null = null;

async function bootstrapServer(): Promise<express.Express> {
  if (!cachedApp) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.enableCors({
      origin: '*',
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    cachedApp = expressApp;
  }
  return cachedApp;
}

export default async (req: express.Request, res: express.Response) => {
  const server = await bootstrapServer();
  server(req, res);
};