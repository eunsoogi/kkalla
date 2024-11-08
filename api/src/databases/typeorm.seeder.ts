import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { seedOrder as developmentSeedOrder, seeds as developmentSeeds } from './seeds/development.seed';

export class Seeder {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.seedAll();
  }

  private static readonly seedMap = {
    development: developmentSeeds,
  };

  private static readonly seedOrderMap = {
    development: developmentSeedOrder,
  };

  public async seedAll() {
    const environment = process.env.NODE_ENV || 'development';
    const seedFunc = Seeder.seedMap[environment];
    const seedOrder = Seeder.seedOrderMap[environment];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const entityName of seedOrder) {
        await seedFunc[entityName]();
      }
      await queryRunner.commitTransaction();
    } catch {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }
}
