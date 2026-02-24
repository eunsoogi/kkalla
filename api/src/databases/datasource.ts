import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT, 10) ?? 3306,
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'kkalla',
  database: process.env.DB_DATABASE ?? 'test',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  subscribers: [__dirname + '/../**/*.subscriber{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'each',
  migrationsRun: process.env.NODE_ENV === 'production',
  synchronize: process.env.NODE_ENV !== 'production',
  timezone: process.env.TZ_OFFSET,
  namingStrategy: new SnakeNamingStrategy(),
});

export default AppDataSource;
