import { Job, Queue, Worker } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import { TtsJobPayload } from './jobs.dto';
import { connectionUrl, makeTtsQueue, prefix, TTS_QUEUE } from './queue.config';

const redisOpts: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const connectionOptions = {
  url: connectionUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const pub = new IORedis(connectionUrl, redisOpts);

export const ttsQueueName = TTS_QUEUE;
export const ttsQueue: Queue<TtsJobPayload> = makeTtsQueue();

export const SNAPSHOT_TTL_SEC = Number(process.env.SNAPSHOT_TTL_SEC ?? 900);

export async function enqueueTtsJob(payload: TtsJobPayload): Promise<{ jobId: string }> {
  const job = await ttsQueue.add('block', payload, {
    attempts: Number(process.env.QUEUE_ATTEMPTS ?? 2),
    backoff: { type: 'fixed', delay: Number(process.env.QUEUE_BACKOFF_MS ?? 2000) },
  });
  return { jobId: String(job.id) };
}

export function getTtsJob(jobId: string) {
  return ttsQueue.getJob(jobId);
}

export function waitForTtsQueue() {
  return ttsQueue.waitUntilReady();
}

export function startTtsWorker() {
  const concurrency = Number(process.env.QUEUE_CONCURRENCY || 1);

  return new Worker<TtsJobPayload>(
    ttsQueueName,
    async (job: Job<TtsJobPayload>) => {
      const rows = job.data.rows;
      if (!rows || rows.length === 0) {
        throw new Error('rows missing or empty');
      }
      const total = rows.length;
      const channel = `progress:${job.id}`;

      for (let i = 0; i < total; i++) {
        await emit(channel, {
          type: 'row',
          rowIndex: i,
          total,
          state: 'running',
        });
        await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 200));
        const fakeMetrics = {
          lufsIntegrated: -16 + (Math.random() - 0.5) * 0.5,
          truePeakDb: -1.4 + Math.random() * 0.4,
          clippingPct: 0,
          score: 0.9,
          warnings: [] as string[],
        };
        await emit(channel, {
          type: 'row',
          rowIndex: i,
          total,
          state: 'done',
          fileKey: `blocks/${job.data.blockId}/rows/${String(i).padStart(3, '0')}_${rows[i].rowId}.wav`,
          bytes: 40960,
          durationMs: 950,
          metrics: fakeMetrics,
        });
      }

      await emit(channel, {
        type: 'final',
        state: 'done',
        manifestKey: `blocks/${job.data.blockId}/manifest.json`,
        qcSummary: {
          rowsPass: total,
          rowsFail: 0,
          blockLufs: -16.0,
          blockTruePeakDb: -1.2,
          blockClippingPct: 0,
        },
      });
      return { ok: true };
    },
    {
      connection: connectionOptions,
      prefix,
      concurrency,
    },
  );
}

async function emit(channel: string, payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  await pub.publish(channel, serialized);
  await pub.set(`${channel}:last`, serialized, 'EX', SNAPSHOT_TTL_SEC);
}

export { connectionOptions as workerConnectionOptions };
