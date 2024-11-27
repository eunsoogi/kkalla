import { Module } from '@nestjs/common';
import { TypeOrmModule as TypeOrmModuleRoot } from '@nestjs/typeorm';

import { typeORMConfig } from './typeorm.config';
import { TypeOrmSeeder } from './typeorm.seeder';

@Module({
  imports: [TypeOrmModuleRoot.forRoot(typeORMConfig)],
  providers: [TypeOrmSeeder],
  exports: [TypeOrmSeeder],
})
export class TypeOrmModule {}
