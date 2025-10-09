import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { BlocksModule } from '../blocks/blocks.module';
import { InlineTtsWorker } from './inline.worker';

@Module({
  imports: [BlocksModule],
  providers: [JobsService, InlineTtsWorker],
  controllers: [JobsController],
})
export class JobsModule {}
