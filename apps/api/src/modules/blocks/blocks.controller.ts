import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { BlocksService } from './blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly svc: BlocksService) {}

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
}
