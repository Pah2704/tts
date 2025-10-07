import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Storage {
  stream(fileKey: string): NodeJS.ReadableStream;
  readJson<T = unknown>(fileKey: string): T;
}

export class StorageNotFoundError extends Error {
  constructor(resource: string) {
    super(`Storage resource not found: ${resource}`);
    this.name = 'StorageNotFoundError';
  }
}

export class FsStorage implements Storage {
  constructor(private readonly root = process.env.STORAGE_ROOT || '/data/storage') {}

  private resolve(fileKey: string) {
    return path.join(this.root, fileKey);
  }

  stream(fileKey: string) {
    const full = this.resolve(fileKey);
    if (!fs.existsSync(full)) throw new StorageNotFoundError(fileKey);
    return fs.createReadStream(full);
  }

  readJson<T = unknown>(fileKey: string): T {
    const full = this.resolve(fileKey);
    if (!fs.existsSync(full)) throw new StorageNotFoundError(fileKey);
    const raw = fs.readFileSync(full, 'utf-8');
    return JSON.parse(raw) as T;
  }
}

export const STORAGE = Symbol('STORAGE');

export const createFsStorageProvider = () => ({
  provide: STORAGE,
  useClass: FsStorage,
});
