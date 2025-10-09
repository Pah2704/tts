import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';
import { enqueueTtsJob, getTtsJob, SNAPSHOT_TTL_SEC, ttsQueueName, waitForTtsQueue } from './jobs.queue';
import { TtsJobPayload } from './jobs.dto';

const redisOpts = {
  maxRetriesPerRequest: null as number | null,
  enableReadyCheck: false,
};

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobsService.name);
  private readonly snapshotTtl = SNAPSHOT_TTL_SEC;
  private readonly kv = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', redisOpts);

  async onModuleInit(): Promise<void> {
    await waitForTtsQueue();
    this.log.log(`Queue ready: ${ttsQueueName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.kv.quit().catch(() => undefined);
  }

  async create(payload: TtsJobPayload): Promise<{ jobId: string }> {
    const { jobId } = await enqueueTtsJob(payload);
    const channel = `progress:${jobId}`;
    const snapshot = {
      type: 'queued',
      state: 'waiting',
      jobId,
      blockId: payload.blockId,
    };
    try {
      await this.kv.setex(`${channel}:last`, this.snapshotTtl, JSON.stringify(snapshot));
    } catch (err) {
      this.log.warn(`Failed to cache initial snapshot for job ${jobId}: ${err}`);
    }
    this.log.log(`Enqueued TTS job id=${jobId}`);
    return { jobId };
  }

  get(jobId: string) {
    return getTtsJob(jobId);
  }
}
