import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startTtsWorker } from './modules/jobs/jobs.queue';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = +(process.env.API_PORT ?? 4000);
  await app.listen(port);

  // Chỉ bật khi debug host-mode
  if (process.env.API_INLINE_WORKER === '1') {
    startTtsWorker();
  }
}
bootstrap();
