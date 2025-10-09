import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { createStorageProvider } from '../../storage/storage';

@Module({
  controllers: [FilesController],
  providers: [createStorageProvider()],
})
export class FilesModule {}
