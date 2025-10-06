import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { createFsStorageProvider } from '../../storage/storage';


@Module({ controllers: [BlocksController], providers: [BlocksService, createFsStorageProvider()], exports: [BlocksService] })
export class BlocksModule {}
