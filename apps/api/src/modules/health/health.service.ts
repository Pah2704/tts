import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import {
  HeadBucketCommand,
  ListBucketsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { queueConfig, queueConnection, redisEndpoint } from '../jobs/queue.config';
import { ttsQueue } from '../jobs/jobs.queue';

type Status = 'up' | 'down';

export interface ComponentStatus {
  status: Status;
  details?: Record<string, unknown>;
  error?: string;
}

export interface HealthPayload {
  ok: boolean;
  timestamp: string;
  redis: ComponentStatus;
  minio: ComponentStatus;
  queue: ComponentStatus;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis = new IORedis({ ...queueConnection });

  private readonly s3 = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: this.resolveBool(process.env.S3_FORCE_PATH_STYLE, true),
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID ??
        process.env.S3_ACCESS_KEY ??
        'minioadmin',
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY ??
        process.env.S3_SECRET_KEY ??
        'minioadmin',
    },
  });

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
    this.s3.destroy();
  }

  async check(): Promise<HealthPayload> {
    const [redis, minio, queue] = await Promise.all([
      this.checkRedis(),
      this.checkMinio(),
      this.checkQueue(),
    ]);

    return {
      ok: [redis, minio, queue].every((item) => item.status === 'up'),
      timestamp: new Date().toISOString(),
      redis,
      minio,
      queue,
    };
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        status: pong === 'PONG' ? 'up' : 'down',
        details: {
          latencyMs: Date.now() - started,
          pong,
          redis: redisEndpoint,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        error: this.stringifyError(error),
      };
    }
  }

  private async checkMinio(): Promise<ComponentStatus> {
    const bucket = process.env.S3_BUCKET ?? 'tts-vtn';
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return {
        status: 'up',
        details: { bucket, endpoint: process.env.S3_ENDPOINT },
      };
    } catch (error) {
      try {
        const list = await this.s3.send(new ListBucketsCommand({}));
        return {
          status: 'down',
          error: this.stringifyError(error),
          details: { buckets: list.Buckets?.map((b) => b.Name) ?? [] },
        };
      } catch (listErr) {
        return {
          status: 'down',
          error: this.stringifyError(error ?? listErr),
        };
      }
    }
  }

  private async checkQueue(): Promise<ComponentStatus> {
    try {
      await ttsQueue.waitUntilReady();
      const counts = await ttsQueue.getJobCounts();
      return {
        status: 'up',
        details: {
          name: queueConfig.ttsQueueName,
          prefix: queueConfig.prefix,
          counts,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        error: this.stringifyError(error),
      };
    }
  }

  private resolveBool(value: string | undefined, fallback: boolean): boolean {
    if (value == null) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }
}
