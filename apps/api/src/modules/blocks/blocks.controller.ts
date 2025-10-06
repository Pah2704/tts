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
  getManifest(@Param('id') id: string) {
    try {
      return this.storage.readJson(`blocks/${id}/manifest.json`);
    } catch (err) {
      if (err instanceof StorageNotFoundError) throw new NotFoundException('Manifest not found');
      throw err;
    }
  }
}
