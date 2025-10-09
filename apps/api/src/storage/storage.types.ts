import type { Readable } from 'node:stream';

export interface StorageObject {
  body: unknown;
  contentType?: string;
  contentLength?: number;
}

export interface Storage {
  getObject(fileKey: string): Promise<StorageObject>;
  stream(fileKey: string): Promise<Readable>;
  readJson<T = unknown>(fileKey: string): Promise<T>;
}

export class StorageNotFoundError extends Error {
  constructor(resource: string) {
    super(`Storage resource not found: ${resource}`);
    this.name = 'StorageNotFoundError';
  }
}

export const STORAGE = Symbol('STORAGE');
