import { Job, Queue, Worker } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import { TtsJobPayload } from './jobs.dto';
import { makeTtsQueue, prefix, TTS_QUEUE, queueConnection, queueConfig, redisEndpoint } from './queue.config';

const redisOpts: RedisOptions = { ...queueConnection };

const pub = new IORedis(redisOpts);

export const ttsQueueName = TTS_QUEUE;
export const ttsQueue: Queue<TtsJobPayload> = makeTtsQueue();

export const SNAPSHOT_TTL_SEC = Number(process.env.SNAPSHOT_TTL_SEC ?? 900);
export const JOB_SNAPSHOT_TTL_SEC = Number(process.env.JOB_SNAPSHOT_TTL_SEC ?? 60);
const JOB_SNAPSHOT_PREFIX = 'bull:snap:job:';

export async function enqueueTtsJob(payload: TtsJobPayload): Promise<{ jobId: string }> {
  const job = await ttsQueue.add('block', payload, {
    attempts: Number(process.env.QUEUE_ATTEMPTS ?? 2),
    backoff: { type: 'fixed', delay: Number(process.env.QUEUE_BACKOFF_MS ?? 2000) },
  });
  const jobId = String(job.id);
  await setJobSnapshot(jobId, 'waiting', {
    queue: queueConfig.ttsQueueName,
    prefix,
    redis: redisEndpoint,
    blockId: payload.blockId,
  });
  return { jobId };
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
      const jobId = String(job.id);

      for (let i = 0; i < total; i++) {
        await emit(jobId, {
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
        await emit(jobId, {
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

      await emit(jobId, {
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
      connection: { ...queueConnection },
      prefix,
      concurrency,
    },
  );
}

async function emit(jobId: string, payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  const channelName = `progress:${jobId}`;
  await pub.publish(channelName, serialized);
  await pub.set(`${channelName}:last`, serialized, 'EX', SNAPSHOT_TTL_SEC);
  const state = typeof payload.state === 'string' ? payload.state : undefined;
  if (state) {
    await setJobSnapshot(jobId, mapState(state), { payload });
  }
}

function mapState(state: string): string {
  if (state === 'completed' || state === 'done') return 'done';
  if (state === 'failed' || state === 'error') return 'error';
  if (state === 'running') return 'running';
  if (state === 'waiting') return 'waiting';
  return state;
}

export function jobSnapshotKey(jobId: string): string {
  return `${JOB_SNAPSHOT_PREFIX}${jobId}`;
}

export async function setJobSnapshot(jobId: string, state: string, extra: Record<string, unknown> = {}) {
  const snapshot = JSON.stringify({
    jobId,
    state: mapState(state),
    updatedAt: new Date().toISOString(),
    ...extra,
  });
  await pub.set(jobSnapshotKey(jobId), snapshot, 'EX', JOB_SNAPSHOT_TTL_SEC);
}

export { queueConfig };
