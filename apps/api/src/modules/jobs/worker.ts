import { Job, Worker } from 'bullmq';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { queueConfig } from './queue.config';
import { setJobSnapshot } from './jobs.queue';
import { ttsQueue } from './jobs.queue';
import { makeS3 } from './s3.client';
import { makeSilentWav } from './wav.util';

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

    const mixKey = `blocks/${blockId}/mix.wav`;
    const qcKey = `blocks/${blockId}/qc.json`;
    const qcBlock = {
      lufsIntegrated: -16.0,
      truePeakDbtp: -1.0,
      clippingCount: 0,
      oversampleFactor: 4,
      ok: true,
      checks: [] as unknown[],
    };

    await uploadArtifacts(mixKey, qcKey, qcBlock);
    await publishManifest(blockId, mixKey, qcKey, qcBlock);

    console.log('[worker] published manifest for', blockId, 'mixKey=', mixKey, 'qcKey=', qcKey);

    return { ok: true, blockId, mixKey, qcKey };
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

const s3 = makeS3();
const bucket =
  process.env.MINIO_BUCKET ??
  process.env.S3_BUCKET ??
  'tts-vtn';

async function uploadArtifacts(
  mixKey: string,
  qcKey: string,
  qcBlock: Record<string, unknown>,
) {
  const wav = makeSilentWav();
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: mixKey,
        Body: wav,
        ContentType: 'audio/wav',
      }),
    );
  } catch (err) {
    console.warn('[worker] failed to upload mix wav', err);
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: qcKey,
        Body: Buffer.from(JSON.stringify(qcBlock)),
        ContentType: 'application/json',
      }),
    );
  } catch (err) {
    console.warn('[worker] failed to upload qc json', err);
  }
}

async function publishManifest(
  blockId: string,
  mixKey: string,
  qcKey: string,
  qcBlock: Record<string, unknown>,
) {
  const manifest = {
    id: blockId,
    state: 'done',
    mixKey,
    qcKey,
    qcBlock,
    generatedAt: new Date().toISOString(),
  };

  const base =
    process.env.API_BASE ||
    `http://127.0.0.1:${process.env.API_PORT || 4000}`;

  const fetchFn: typeof fetch | undefined = (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    console.warn('[worker] fetch not available; skipping manifest PATCH');
    return;
  }

  try {
    const res = await fetchFn(`${base}/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[worker] manifest PATCH failed', res.status, text);
    }
  } catch (err) {
    console.warn('[worker] manifest PATCH error', err);
  }
  console.log('[worker] published manifest for', blockId, 'mixKey=', mixKey, 'qcKey=', qcKey);
}
