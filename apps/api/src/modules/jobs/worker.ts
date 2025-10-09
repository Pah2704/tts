import { Job, Worker } from 'bullmq';
import { queueConfig } from './queue.config';
import { setJobSnapshot } from './jobs.queue';
import { ttsQueue } from './jobs.queue';

const worker = new Worker(
  queueConfig.ttsQueueName,
  async (job: Job) => {
    const { blockId } = job.data as { blockId: string };
    const jobId = String(job.id);

    await setJobSnapshot(jobId, 'running', { step: 'start', blockId });
    await job.updateProgress({ step: 'start', blockId });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await job.updateProgress({ step: 'done', blockId });
    await setJobSnapshot(jobId, 'done', { step: 'done', blockId });

    return { ok: true, blockId };
  },
  {
    connection: { ...queueConfig.connection },
    prefix: queueConfig.prefix,
  },
);

worker.on('completed', (job) => {
  console.log(`[worker] completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] failed job ${job?.id}`, err);
});

const shutdown = async () => {
  console.log('[worker] shutting down');
  try {
    await worker.close();
  } catch (err) {
    console.error('[worker] error closing worker', err);
  }
  try {
    await ttsQueue.close();
  } catch (err) {
    console.error('[worker] error closing queue', err);
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
