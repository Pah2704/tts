import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BlocksModule } from './modules/blocks/blocks.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [BlocksModule, JobsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
