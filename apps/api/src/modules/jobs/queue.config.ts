import { Queue, QueueOptions } from 'bullmq';
import { RedisOptions } from 'ioredis';
import { TtsJobPayload } from './jobs.dto';

const connectionUrl =
  process.env.BULLMQ_CONNECTION ??
  process.env.BULL_REDIS_URL ??
  process.env.REDIS_URL ??
  'redis://127.0.0.1:6379';

let derivedHost = '127.0.0.1';
let derivedPort = 6379;
try {
  const parsed = new URL(connectionUrl);
  derivedHost = parsed.hostname || derivedHost;
  derivedPort = parsed.port ? Number(parsed.port) : derivedPort;
} catch {
  // keep defaults if URL parsing fails
}

export const redisHost = process.env.REDIS_HOST ?? derivedHost;
export const redisPort = Number(process.env.REDIS_PORT ?? derivedPort);

const rawQueueName =
  process.env.TTS_QUEUE ??
  process.env.JOBS_QUEUE ??
  process.env.BULL_QUEUE ??
  process.env.BULLMQ_QUEUE ??
  process.env.QUEUE_TTS_BLOCK ??
  'tts';

const sanitizedQueueName = rawQueueName.replace(/[:\s]+/g, '_');

if (sanitizedQueueName.includes(':')) {
  throw new Error('TTS queue name must not contain colons');
}

export const queueConnection: RedisOptions = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: 10_000,
  retryStrategy: (times: number) => Math.min(times * 500, 5_000),
};

export const queueConfig = {
  prefix: process.env.BULLMQ_PREFIX ?? process.env.BULL_PREFIX ?? 'bull',
  ttsQueueName: sanitizedQueueName,
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: Number(process.env.BULLMQ_REMOVE_ON_COMPLETE_AGE ?? 3600),
      count: 1000,
    },
    removeOnFail: {
      age: Number(process.env.BULLMQ_REMOVE_ON_FAIL_AGE ?? 86400),
      count: 1000,
    },
  } satisfies QueueOptions['defaultJobOptions'],
};

const baseOptions: QueueOptions = {
  connection: queueConfig.connection,
  prefix: queueConfig.prefix,
  defaultJobOptions: queueConfig.defaultJobOptions,
};

export const redisEndpoint = `${redisHost}:${redisPort}`;

console.log(
  `[queue] prefix=${queueConfig.prefix} queue=${queueConfig.ttsQueueName} redis=${redisEndpoint}`,
);

export function makeTtsQueue(): Queue<TtsJobPayload> {
  return new Queue<TtsJobPayload>(queueConfig.ttsQueueName, baseOptions);
}

export const TTS_QUEUE = queueConfig.ttsQueueName;
export const prefix = queueConfig.prefix;
