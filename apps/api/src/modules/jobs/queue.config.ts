import { Queue, QueueOptions } from 'bullmq';
import { TtsJobPayload } from './jobs.dto';

const connectionUrl =
  process.env.BULLMQ_CONNECTION ??
  process.env.BULL_REDIS_URL ??
  process.env.REDIS_URL ??
  'redis://127.0.0.1:6379';

export const prefix =
  process.env.BULLMQ_PREFIX ??
  process.env.BULL_PREFIX ??
  'bull';

export const TTS_QUEUE =
  process.env.TTS_QUEUE ??
  process.env.JOBS_QUEUE ??
  process.env.BULL_QUEUE ??
  process.env.BULLMQ_QUEUE ??
  process.env.QUEUE_TTS_BLOCK ??
  'tts_block';

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  removeOnComplete: {
    age: Number(process.env.BULLMQ_REMOVE_ON_COMPLETE_AGE ?? 60),
    count: 1000,
  },
  removeOnFail: {
    age: Number(process.env.BULLMQ_REMOVE_ON_FAIL_AGE ?? 600),
    count: 1000,
  },
};

const baseOptions: QueueOptions = {
  connection: { url: connectionUrl },
  prefix,
  defaultJobOptions,
};

export function makeTtsQueue(): Queue<TtsJobPayload> {
  return new Queue<TtsJobPayload>(TTS_QUEUE, baseOptions);
}

export { connectionUrl };
