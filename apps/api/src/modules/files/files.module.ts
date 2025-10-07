import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { createFsStorageProvider } from '../../storage/storage';

@Module({
  controllers: [FilesController],
  providers: [createFsStorageProvider()],
})
export class FilesModule {}
