import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { EncryptionOptions } from 'typeorm-encrypted';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { decrypt } from '@/utils/key';

export const typeORMConfig: TypeOrmModuleOptions = {
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT, 10) ?? 3306,
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrationsRun: process.env.NODE_ENV === 'production',
  synchronize: process.env.NODE_ENV !== 'production',
  timezone: process.env.TZ_OFFSET,
  namingStrategy: new SnakeNamingStrategy(),
};

export const typeORMEncryptionConfig: EncryptionOptions = {
  key: decrypt(process.env.DB_SECRET),
  algorithm: 'aes-256-gcm',
  ivLength: 16,
};
