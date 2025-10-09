import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

import { Storage, StorageNotFoundError, StorageObject } from './storage.types';

export class S3Storage implements Storage {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || '1') === '1';
    this.bucket = process.env.S3_BUCKET || 'tts-vtn';
    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
    });
  }

  async getObject(fileKey: string): Promise<StorageObject> {
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }));
      if (!out.Body) throw new StorageNotFoundError(fileKey);
      return {
        body: out.Body,
        contentType: out.ContentType,
        contentLength: out.ContentLength,
      };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
        throw new StorageNotFoundError(fileKey);
      }
      throw err;
    }
  }

  async stream(fileKey: string): Promise<Readable> {
    const { body } = await this.getObject(fileKey);
    const streamLike: any = body;
    if (streamLike?.pipe) return streamLike as Readable;
    if (typeof streamLike?.transformToByteArray === 'function') {
      const buf = Buffer.from(await streamLike.transformToByteArray());
      return Readable.from(buf);
    }
    if (streamLike && typeof streamLike[Symbol.asyncIterator] === 'function') {
      return Readable.from(streamLike as AsyncIterable<Uint8Array>);
    }
    if (ArrayBuffer.isView(streamLike)) {
      return Readable.from(streamLike as Uint8Array);
    }
    if (streamLike instanceof ArrayBuffer) {
      return Readable.from(Buffer.from(streamLike));
    }
    throw new Error('Unsupported S3 body type');
  }

  async readJson<T = unknown>(fileKey: string): Promise<T> {
    const body = await this.stream(fileKey);
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(raw) as T;
  }

  async head(key: string) {
    await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { key };
  }

  async put(key: string, body: Buffer | Uint8Array | string, contentType?: string) {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body as any,
      ContentType: contentType,
    }));
    return { key };
  }
}
