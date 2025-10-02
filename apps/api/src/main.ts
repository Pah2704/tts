import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class AppController {
  @Get('/')
  root() { return { ok: true, service: 'api', msg: 'Hello from Nest API' }; }
  @Get('/hello')
  hello() { return { hello: 'world' }; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: false });
  const port = process.env.PORT || 4000;
  await app.listen(port as number);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
