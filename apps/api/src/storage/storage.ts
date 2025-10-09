import { FsStorage } from './fs.storage';
import { S3Storage } from './s3.storage';
import { STORAGE, Storage, StorageNotFoundError, StorageObject } from './storage.types';

const kind = (process.env.STORAGE_KIND || 'fs').toLowerCase();

export const storage: Storage = kind === 's3'
  ? new S3Storage()
  : new FsStorage({ root: process.env.STORAGE_ROOT || '/data/storage' });

export { STORAGE, Storage, StorageNotFoundError, StorageObject };

export const createStorageProvider = () => ({
  provide: STORAGE,
  useValue: storage,
});
