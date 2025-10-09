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
      const out = await this.storage.getObject(p);
      if (out.contentType) {
        res.setHeader('Content-Type', out.contentType);
      } else {
        res.setHeader('Content-Type', guess(p));
      }
      if (out.contentLength != null) res.setHeader('Content-Length', String(out.contentLength));

      const body: any = out.body;
      if (body?.pipe) {
        body.on?.('error', (err: Error) => res.destroy(err));
        body.pipe(res);
        return;
      }
      if (typeof body?.transformToByteArray === 'function') {
        const buf = Buffer.from(await body.transformToByteArray());
        res.end(buf);
        return;
      }
      if (body instanceof Uint8Array || ArrayBuffer.isView(body)) {
        res.end(Buffer.from(body as Uint8Array));
        return;
      }
      if (body instanceof ArrayBuffer) {
        res.end(Buffer.from(body));
        return;
      }
      res.status(500).json({ message: 'Invalid storage body' });
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
