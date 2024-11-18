import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

export class Migration1731628833985 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasInferenceSeq = await queryRunner.hasColumn('inference', 'seq');
    const hasTradeSeq = await queryRunner.hasColumn('trade', 'seq');
    const hasNotifySeq = await queryRunner.hasColumn('notify', 'seq');

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

    if (!hasInferenceSeq) {
      await queryRunner.addColumn(
        'inference',
        new TableColumn({
          name: 'seq',
          type: 'bigint',
        }),
      );
    }

    if (!hasTradeSeq) {
      await queryRunner.addColumn(
        'trade',
        new TableColumn({
          name: 'seq',
          type: 'bigint',
        }),
      );
    }

    if (!hasNotifySeq) {
      await queryRunner.addColumn(
        'notify',
        new TableColumn({
          name: 'seq',
          type: 'bigint',
        }),
      );
    }

    const inferences = await queryRunner.query(`SELECT id FROM inference ORDER BY created_at ASC`);

    for (const inference of inferences) {
      const sequence = await queryRunner.manager.save(new Sequence());
      await queryRunner.query(`UPDATE inference SET seq = ? WHERE id = ?`, [sequence.value, inference.id]);
    }

    const trades = await queryRunner.query(`SELECT id FROM trade ORDER BY created_at ASC`);

    for (const trade of trades) {
      const sequence = await queryRunner.manager.save(new Sequence());
      await queryRunner.query(`UPDATE trade SET seq = ? WHERE id = ?`, [sequence.value, trade.id]);
    }

    const notifies = await queryRunner.query(`SELECT id FROM notify ORDER BY created_at ASC`);

    for (const notify of notifies) {
      const sequence = await queryRunner.manager.save(new Sequence());
      await queryRunner.query(`UPDATE notify SET seq = ? WHERE id = ?`, [sequence.value, notify.id]);
    }

    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
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
