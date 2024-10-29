import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeORMConfig: TypeOrmModuleOptions = {
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT, 10) ?? 3306,
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  timezone: process.env.TZ,
};
