import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Handler, Context, Callback } from 'aws-lambda';
import serverless from 'serverless-http';

let server: Handler;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
}

export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  if (!server) {
    server = await bootstrap();
  }
  return server(event, context, callback);
};