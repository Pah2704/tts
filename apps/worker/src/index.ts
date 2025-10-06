import IORedis from 'ioredis';
import { Worker, Job } from 'bullmq';

type Row = { rowId: string; text: string };
type Payload = { blockId: string; rows: Row[]; engine?: 'piper'|'xtts'; projectId?: string };

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const RAW_QUEUE = process.env.QUEUE_TTS_BLOCK || 'tts_block';
const QUEUE = RAW_QUEUE.replace(/[:\s]+/g, '_');
const CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY || 1);

const redisOpts = { maxRetriesPerRequest: null as any, enableReadyCheck: false };
const connection = new IORedis(REDIS_URL, redisOpts);
const pub = new IORedis(REDIS_URL, redisOpts);
const kv = new IORedis(REDIS_URL, redisOpts); // dùng lưu snapshot
const SNAP_TTL = Number(process.env.SNAPSHOT_TTL_SEC || 600);

async function publishWithSnapshot(ch: string, obj: any) {
  const json = JSON.stringify(obj);
  await Promise.all([
    pub.publish(ch, json),
    kv.set(`${ch}:last`, json, 'EX', SNAP_TTL)
  ]);
}

new Worker<Payload>(
  QUEUE,
  async (job) => {
    console.log(`[worker] got job ${job.id} rows=${job.data.rows?.length ?? 0}`);
    const rows = job.data.rows || [];
    const total = rows.length;
    const ch = `progress:${job.id}`;
    const t0 = Date.now();

    await publishWithSnapshot(ch, { type: 'row', rowIndex: 0, total, state: 'queued' });

    for (let i = 0; i < total; i++) {
      const tStart = Date.now();
      await publishWithSnapshot(ch, { type: 'row', rowIndex: i, total, state: 'running' });
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      await publishWithSnapshot(ch, {
        type: 'row', rowIndex: i, total, state: 'done', tElapsedMs: Date.now() - tStart
      });
    }

    await publishWithSnapshot(ch, {
      type: 'final', state: 'done', manifest: { elapsedMs: Date.now() - t0 }
    });
    return { ok: true };
  },
  { connection, concurrency: CONCURRENCY }
);

console.log(`[worker] started queue=${QUEUE} redis=${REDIS_URL} conc=${CONCURRENCY}`);
