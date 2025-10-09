import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post } from '@nestjs/common';

import {
  STORAGE,
  Storage,
  StorageNotFoundError,
} from '../../storage/storage';

import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { BlocksService } from './blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(
    private readonly svc: BlocksService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  @Post()
  create(@Body() dto: CreateBlockDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    if (body?.manifest) {
      await this.svc.setManifest(id, body.manifest);
      return { ok: true };
    }
    return this.svc.update(id, body as UpdateBlockDto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Get(':id/manifest')
  async getManifest(@Param('id') id: string) {
    const cached = await this.svc.getManifest(id);
    if (cached) return cached;

    const manifestKey = `blocks/${id}/manifest.json`;
    const notReady = () =>
      new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: { error: 'Manifest not ready' },
      });

    try {
      const manifest = await this.storage.readJson<Record<string, unknown>>(manifestKey);
      if (manifest == null || typeof manifest !== 'object') {
        throw notReady();
      }
      return manifest;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if (err instanceof StorageNotFoundError || err instanceof SyntaxError) {
        throw notReady();
      }
      throw err;
    }
  }
}
