import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { runSeeder } from 'typeorm-extension';

import { seeders as developmentSeeders } from './seeds/development.seed';
import { seeders as productionSeeders } from './seeds/production.seed';
import { RoleSeeder } from './seeds/role.seed';
import { seeders as stagingSeeders } from './seeds/staging.seed';

@Injectable()
export class TypeOrmSeeder {
  private readonly logger = new Logger(TypeOrmSeeder.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.seedAll();
  }

  async seedAll() {
    const env = process.env.NODE_ENV || 'development';
    let seeders: any[] = [];

    switch (env) {
      case 'production':
        seeders = productionSeeders;
        break;
      case 'staging':
        seeders = stagingSeeders;
        break;
      case 'development':
      default:
        seeders = developmentSeeders;
        break;
    }

    this.logger.log(`Running seeders for ${env} environment...`);

    try {
      this.logger.log('Running RoleSeeder...');

      await runSeeder(this.dataSource, RoleSeeder);

      this.logger.log('Successfully ran RoleSeeder');

      for (const seeder of seeders) {
        await runSeeder(this.dataSource, seeder);
        this.logger.log(`Successfully ran seeder: ${seeder.name}`);
      }
      this.logger.log('Seeding completed successfully');
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
