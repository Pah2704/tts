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
  update(@Param('id') id: string, @Body() dto: UpdateBlockDto) {
    return this.svc.update(id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Get(':id/manifest')
  async getManifest(@Param('id') id: string) {
    const manifestKey = `blocks/${id}/manifest.json`;
    const notReady = () => new NotFoundException({ error: 'Manifest not ready' });

    try {
      const manifest = await this.storage.readJson<Record<string, unknown>>(manifestKey);
      if (manifest == null || typeof manifest !== 'object') {
        throw notReady();
      }
      return manifest;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if (err instanceof StorageNotFoundError) throw notReady();
      if (err instanceof SyntaxError) throw notReady();
      throw err;
    }
  }
}
