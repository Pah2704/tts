import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { createStorageProvider } from '../../storage/storage';

@Module({ controllers: [BlocksController], providers: [BlocksService, createStorageProvider()], exports: [BlocksService] })
export class BlocksModule {}
