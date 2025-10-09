import * as fs from 'node:fs';
import * as path from 'node:path';

import { Storage, StorageNotFoundError, StorageObject } from './storage.types';

type FsStorageOptions = { root?: string } | string | undefined;

export class FsStorage implements Storage {
  private readonly root: string;

  constructor(options?: FsStorageOptions) {
    if (typeof options === 'string') {
      this.root = options;
    } else {
      this.root = options?.root || process.env.STORAGE_ROOT || '/data/storage';
    }
  }

  private resolve(fileKey: string) {
    return path.join(this.root, fileKey);
  }

  async getObject(fileKey: string): Promise<StorageObject> {
    const full = this.resolve(fileKey);
    try {
      await fs.promises.access(full, fs.constants.R_OK);
    } catch {
      throw new StorageNotFoundError(fileKey);
    }
    const stat = await fs.promises.stat(full);
    return {
      body: fs.createReadStream(full),
      contentLength: stat.size,
    };
  }

  async stream(fileKey: string) {
    const out = await this.getObject(fileKey);
    return out.body as fs.ReadStream;
  }

  async readJson<T = unknown>(fileKey: string): Promise<T> {
    const full = this.resolve(fileKey);
    try {
      await fs.promises.access(full, fs.constants.R_OK);
    } catch {
      throw new StorageNotFoundError(fileKey);
    }
    const raw = await fs.promises.readFile(full, 'utf-8');
    return JSON.parse(raw) as T;
  }
}
