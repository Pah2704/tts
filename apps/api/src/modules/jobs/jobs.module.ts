import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { BlocksModule } from '../blocks/blocks.module';

@Module({
  imports: [BlocksModule],
  providers: [JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
