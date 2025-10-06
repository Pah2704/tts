import { Queue, Worker, Job } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import { TtsJobPayload } from './jobs.dto';

const redisUrl = process.env.REDIS_URL!;
const redisOpts: RedisOptions = {
  // BẮT BUỘC với BullMQ Worker (blocking):
  maxRetriesPerRequest: null,
  // Nên tắt để tránh ready check treo trên một số môi trường/docker:
  enableReadyCheck: false,
};

const connection = new IORedis(redisUrl, redisOpts);
const pub = new IORedis(redisUrl, redisOpts);

const RAW_QUEUE_NAME = process.env.QUEUE_TTS_BLOCK || 'tts_block';
export const ttsQueueName = RAW_QUEUE_NAME.replace(/[:\s]+/g, '_');
export const ttsQueue = new Queue<TtsJobPayload>(ttsQueueName, { connection });

export async function enqueueTtsJob(payload: TtsJobPayload): Promise<{ jobId: string }> {
  const job = await ttsQueue.add('block', payload, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 2000 },
    removeOnComplete: true,
  });
  return { jobId: String(job.id) };
}

export function startTtsWorker() {
  const concurrency = Number(process.env.QUEUE_CONCURRENCY || 1);

  new Worker<TtsJobPayload>(
    ttsQueueName,
    async (job: Job<TtsJobPayload>) => {
      const rows = job.data.rows;
      if (!rows || rows.length === 0) {
        throw new Error('rows missing or empty');
      }
      const total = rows.length;
      const ch = `progress:${job.id}`;

      for (let i = 0; i < total; i++) {
        await pub.publish(ch, JSON.stringify({ type: 'row', rowIndex: i, total, state: 'running' }));
        await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
        const fakeMetrics = {
          lufsIntegrated: -16 + (Math.random() - 0.5) * 0.5,
          truePeakDb: -1.4 + Math.random() * 0.4,
          clippingPct: 0,
          score: 0.9,
          warnings: [] as string[],
        };
        await pub.publish(ch, JSON.stringify({
          type: 'row',
          rowIndex: i,
          total,
          state: 'done',
          fileKey: `blocks/${job.data.blockId}/rows/${String(i).padStart(3, '0')}_${rows[i].rowId}.wav`,
          bytes: 40960,
          durationMs: 950,
          metrics: fakeMetrics,
        }));
      }

      await pub.publish(ch, JSON.stringify({
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
      }));
      return { ok: true };
    },
    // Quan trọng: truyền connection có maxRetriesPerRequest:null
    { connection, concurrency }
  );
}
