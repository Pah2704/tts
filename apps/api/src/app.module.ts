import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BlocksModule } from './modules/blocks/blocks.module';
import { FilesModule } from './modules/files/files.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [BlocksModule, FilesModule, JobsModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
