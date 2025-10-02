import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: true, credentials: false } });
  app.enableCors({ origin: true, credentials: false });
  const port = process.env.PORT || 4000;
  await app.listen(process.env.API_PORT ?? 4000);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
