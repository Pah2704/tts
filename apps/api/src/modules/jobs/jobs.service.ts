import { Injectable } from '@nestjs/common';
import { enqueueTtsJob } from './jobs.queue';
import { TtsJobPayload } from './jobs.dto';

@Injectable()
export class JobsService {
  create(payload: TtsJobPayload): Promise<{ jobId: string }> {
    return enqueueTtsJob(payload);
  }
}
