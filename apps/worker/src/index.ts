import { Worker, Job } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import { spawn } from 'node:child_process';
import * as path from 'node:path';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const redisOpts: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const queueName = (process.env.QUEUE_TTS_BLOCK || 'tts_block').replace(/[:\s]+/g, '_');
const concurrency = Number(process.env.QUEUE_CONCURRENCY || 1);

const connection = new IORedis(redisUrl, redisOpts);

const worker = new Worker(queueName, (job: Job) => handleJob(job), {
  connection,
  concurrency,
});

worker.on('error', err => {
  console.error('[worker] error', err);
});

async function handleJob(job: Job) {
  const rows = job.data?.rows;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('rows missing or empty');
  }
  const blockId = job.data?.blockId;
  if (!blockId) {
    throw new Error('blockId missing');
  }
  const payload = {
    jobId: String(job.id),
    blockId,
    rows,
    engine: job.data?.engine || process.env.ENGINE_DEFAULT || 'piper',
    projectId: job.data?.projectId,
  };
  await runPython(payload);
  return { ok: true };
}

function runPython(payload: unknown) {
  return new Promise<void>((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'run_block_job.py');
    const child = spawn('python3', ['-u', scriptPath], {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    });

    child.once('error', reject);

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Python worker exited with code ${code}`));
    });
  });
}
