import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { I18nService } from 'nestjs-i18n';
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
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit(): Promise<void> {
    const ran = await this.redlockService.withLock(SEED_LOCK_RESOURCE, SEED_LOCK_DURATION_MS, () => this.seedAll());
    if (ran === undefined) {
      this.logger.log(this.i18n.t('logging.seed.skip_locked'));
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

    this.logger.log(this.i18n.t('logging.seed.start', { args: { env } }));

    try {
      this.logger.log(this.i18n.t('logging.seed.role.start'));

      await runSeeder(this.dataSource, RoleSeeder);

      this.logger.log(this.i18n.t('logging.seed.role.success'));

      for (const seeder of seeders) {
        await runSeeder(this.dataSource, seeder);
        this.logger.log(this.i18n.t('logging.seed.seeder.success', { args: { name: seeder.name } }));
      }
      this.logger.log(this.i18n.t('logging.seed.complete'));
      return true;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.seed.failed'), error);
      throw error;
    }
  }
}
