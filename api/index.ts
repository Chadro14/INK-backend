// api/index.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

let app = null;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { cors: true });
    await app.init();
  }
  return app;
}

module.exports = async (req, res) => {
  const app = await bootstrap();
  const instance = app.getHttpAdapter().getInstance();
  instance(req, res);
};