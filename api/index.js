const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/app.module');

const expressApp = express();
let cachedApp = null;

async function bootstrap() {
  if (cachedApp) {
    return cachedApp;
  }

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp)
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.setGlobalPrefix('api');

  await app.init();
  cachedApp = app;
  return app;
}

module.exports = async (req, res) => {
  try {
    await bootstrap();
    expressApp(req, res);
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Unknown error',
    });
  }
};