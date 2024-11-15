import { MigrationInterface, QueryRunner, Table, TableColumn, TableUnique } from 'typeorm';

import { Inference } from '@/modules/inference/entities/inference.entity';
import { Notify } from '@/modules/notify/entities/notify.entity';
import { Sequence } from '@/modules/sequence/entities/sequence.entity';
import { Trade } from '@/modules/trade/entities/trade.entity';

export class Migration1731628833985 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sequence',
        columns: [
          {
            name: 'value',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
        ],
      }),
      true,
    );

    await queryRunner.addColumn(
      'inference',
      new TableColumn({
        name: 'seq',
        type: 'bigint',
      }),
    );

    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'seq',
        type: 'bigint',
      }),
    );

    await queryRunner.addColumn(
      'notify',
      new TableColumn({
        name: 'seq',
        type: 'bigint',
      }),
    );

    const inferences = await queryRunner.manager.find(Inference, {
      order: {
        createdAt: 'ASC',
      },
    });

    for (const inference of inferences) {
      const sequence = await queryRunner.manager.save(new Sequence());

      await queryRunner.manager.update(
        Inference,
        {
          id: inference.id,
        },
        {
          seq: sequence.value,
        },
      );
    }

    const trades = await queryRunner.manager.find(Trade, {
      order: {
        createdAt: 'ASC',
      },
    });

    for (const trade of trades) {
      const sequence = await queryRunner.manager.save(new Sequence());

      await queryRunner.manager.update(
        Trade,
        {
          id: trade.id,
        },
        {
          seq: sequence.value,
        },
      );
    }

    const notifies = await queryRunner.manager.find(Trade, {
      order: {
        createdAt: 'ASC',
      },
    });

    for (const notify of notifies) {
      const sequence = await queryRunner.manager.save(new Sequence());

      await queryRunner.manager.update(
        Notify,
        {
          id: notify.id,
        },
        {
          seq: sequence.value,
        },
      );
    }

    await queryRunner.createUniqueConstraint(
      'inference',
      new TableUnique({
        columnNames: ['seq'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'trade',
      new TableUnique({
        columnNames: ['seq'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'notify',
      new TableUnique({
        columnNames: ['seq'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('notify', 'seq');
    await queryRunner.dropColumn('trade', 'seq');
    await queryRunner.dropColumn('inference', 'seq');
    await queryRunner.dropTable('sequence');
  }
}
