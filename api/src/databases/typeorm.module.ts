import { Module } from '@nestjs/common';
import { TypeOrmModule as TypeOrmModuleRoot } from '@nestjs/typeorm';

import { typeORMConfig } from './typeorm.config';
import { Seeder } from './typeorm.seeder';

@Module({
  imports: [TypeOrmModuleRoot.forRoot(typeORMConfig)],
  providers: [Seeder],
  exports: [Seeder],
})
export class TypeOrmModule {}
