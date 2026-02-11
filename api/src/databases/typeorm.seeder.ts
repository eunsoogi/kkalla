import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { runSeeder } from 'typeorm-extension';

import { RedlockService } from '@/modules/redlock/redlock.service';

import { seeders as developmentSeeders } from './seeds/development.seed';
import { seeders as productionSeeders } from './seeds/production.seed';
import { RoleSeeder } from './seeds/role.seed';
import { seeders as stagingSeeders } from './seeds/staging.seed';

/** 시딩 락 유지 시간 (5분). 다중 파드에서 한 인스턴스만 시딩 수행. */
const SEED_LOCK_DURATION_MS = 300_000;
const SEED_LOCK_RESOURCE = 'db:seed';

@Injectable()
export class TypeOrmSeeder implements OnModuleInit {
  private readonly logger = new Logger(TypeOrmSeeder.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redlockService: RedlockService,
  ) {}

  async onModuleInit(): Promise<void> {
    const ran = await this.redlockService.withLock(SEED_LOCK_RESOURCE, SEED_LOCK_DURATION_MS, () => this.seedAll());
    if (ran === undefined) {
      this.logger.log('Seeding skipped: another instance holds the seed lock');
    }
  }

  private async seedAll(): Promise<true> {
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
      return true;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
