import { S3Client } from '@aws-sdk/client-s3';

export function makeS3(): S3Client {
  const endpoint =
    process.env.MINIO_ENDPOINT ??
    process.env.S3_ENDPOINT ??
    'http://127.0.0.1:9000';
  const region = process.env.S3_REGION ?? 'us-east-1';
  const accessKeyId =
    process.env.MINIO_ACCESS_KEY ??
    process.env.S3_ACCESS_KEY ??
    'minioadmin';
  const secretAccessKey =
    process.env.MINIO_SECRET_KEY ??
    process.env.S3_SECRET_KEY ??
    'minioadmin';

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}
