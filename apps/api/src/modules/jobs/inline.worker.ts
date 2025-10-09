import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import IORedis from 'ioredis';
import { prefix, TTS_QUEUE, connectionUrl } from './queue.config';
import { workerConnectionOptions, SNAPSHOT_TTL_SEC } from './jobs.queue';
import { TtsJobPayload } from './jobs.dto';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function createSilenceWav(durationMs = 800, sampleRate = 16000): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
  const dataSize = totalSamples * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Silence samples (all zeros) already default.
  return buffer;
}

@Injectable()
export class InlineTtsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(InlineTtsWorker.name);
  private worker?: Worker;
  private readonly redis = new IORedis(connectionUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  private readonly s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: resolveBool(process.env.S3_FORCE_PATH_STYLE, true),
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

  private get bucket(): string {
    return process.env.S3_BUCKET ?? 'tts-vtn';
  }

  async onModuleInit(): Promise<void> {
    const shouldRun =
      resolveBool(process.env.TTS_INLINE_WORKER, false) ||
      resolveBool(process.env.CI, false);
    if (!shouldRun) {
      this.log.debug('Inline worker disabled – skipping init');
      return;
    }

    this.worker = new Worker<TtsJobPayload>(
      TTS_QUEUE,
      async (job) => this.handleJob(job),
      {
        connection: { ...workerConnectionOptions },
        prefix,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.log.error(`Job ${job?.id} failed: ${error?.message ?? error}`);
    });

    await this.worker.waitUntilReady();
    this.log.log(`Inline worker started for queue ${prefix}:${TTS_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.redis.quit().catch(() => undefined);
  }

  private async handleJob(job: Job<TtsJobPayload>): Promise<{ ok: boolean }> {
    const payload = job.data;
    const jobId = String(job.id);

    const blockId = payload.blockId ?? `inline-${jobId}`;
    const rows = Array.isArray(payload.rows) && payload.rows.length > 0
      ? payload.rows
      : [{ rowId: `row-${jobId}`, text: 'Inline synthesis' }];

    const channel = `progress:${jobId}`;
    const ttl = SNAPSHOT_TTL_SEC;

    const publish = async (data: Record<string, unknown>) => {
      const serialized = JSON.stringify(data);
      await this.redis.setex(`${channel}:last`, ttl, serialized);
      await this.redis.publish(channel, serialized);
    };

    await publish({ type: 'queued', state: 'waiting', jobId, blockId });
    await job.updateProgress(1);
    await sleep(50);

    const buffers = rows.map(() => createSilenceWav());
    const rowEntries: Array<Record<string, unknown>> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const key = `blocks/${blockId}/rows/${String(i).padStart(3, '0')}_${row.rowId ?? `row-${i}`}.wav`;
      await this.putObject(key, buffers[i], 'audio/wav');
      rowEntries.push({
        index: i,
        rowId: row.rowId ?? `row-${i}`,
        fileKey: key,
        bytes: buffers[i].length,
        durationMs: 800,
      });
      await publish({
        type: 'row',
        rowIndex: i,
        total: rows.length,
        state: 'done',
        fileKey: key,
      });
      await job.updateProgress(Math.min(99, Math.round(((i + 1) / rows.length) * 100)));
      await sleep(25);
    }

    const mixKey = `blocks/${blockId}/merged.wav`;
    await this.putObject(mixKey, buffers[0], 'audio/wav');

    const qc = {
      lufsIntegrated: -16.0,
      truePeakDbtp: -1.5,
      clippingCount: 0,
      oversampleFactor: 2,
      warnings: [],
      score: 0.95,
      pass: true,
    };

    const qcKey = `qc/block-${blockId}.json`;
    await this.putObject(qcKey, Buffer.from(JSON.stringify(qc)), 'application/json');

    const manifest = {
      blockId,
      engine: payload.engine ?? 'piper',
      voiceId: (payload as { voiceId?: string }).voiceId ?? 'inline-ci',
      createdAt: new Date().toISOString(),
      rows: rowEntries,
      mixKey,
      qcKey,
      qcBlock: qc,
      qcSummary: {
        rowsPass: rows.length,
        rowsFail: 0,
        state: 'done',
      },
    };

    const manifestKey = `blocks/${blockId}/manifest.json`;
    await this.putObject(
      manifestKey,
      Buffer.from(JSON.stringify(manifest)),
      'application/json',
    );

    const finalPayload = {
      type: 'final',
      state: 'done',
      manifestKey,
      qcKey,
      mixKey,
      rowsOk: rows.length,
      rowsFail: 0,
    };
    await publish(finalPayload);
    await job.updateProgress(100);

    return { ok: true };
  }

  private async putObject(key: string, body: Buffer, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
