import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'node:path';
import {
  STORAGE,
  Storage,
  StorageNotFoundError,
} from '../../storage/storage';

@Controller('files')
export class FilesController {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  @Get(':p(*)')
  async get(@Param('p') p: string, @Res() res: Response) {
    try {
      const stream = this.storage.stream(p);
      res.setHeader('Content-Type', guess(p));
      stream.on('error', err => res.destroy(err));
      stream.pipe(res);
    } catch (err) {
      if (err instanceof StorageNotFoundError) throw new NotFoundException('File not found');
      throw err;
    }
  }
}

function guess(fileKey: string) {
  const ext = path.extname(fileKey).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}
