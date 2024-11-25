import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1732495067226 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('trade');
    const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('inference_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('trade', foreignKey);
    }

    await queryRunner.dropColumn('trade', 'inference_id');

    const trades = await queryRunner.query(`SELECT * FROM trade`);
    for (const trade of trades) {
      const decisions = await queryRunner.query(
        `SELECT d.id FROM decision d INNER JOIN inference i ON i.id = d.inference_id WHERE i.id = ?`,
        [trade.inference_id],
      );
      if (!decisions || !decisions[0]) continue;

      await queryRunner.query(`UPDATE trade SET decision_id = ? WHERE id = ?`, [decisions[0].id, trade.id]);
    }

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['decision_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['decision_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'decision',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.dropTable('inference_users_user');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const trades = await queryRunner.query(`SELECT * FROM trade`);

    for (const trade of trades) {
      if (trade.decision_id) {
        const inference = await queryRunner.query(
          `SELECT i.id FROM inference i INNER JOIN decision d ON d.inference_id = i.id WHERE d.id = ?`,
          [trade.decision_id],
        );
        if (inference && inference[0]) {
          await queryRunner.query(`UPDATE trade SET inference_id = ? WHERE id = ?`, [inference[0].id, trade.id]);
        }
      }
    }

    await queryRunner.query(`
            CREATE TABLE inference_users_user (
                inference_id VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL,
                PRIMARY KEY (inference_id, user_id)
            )
        `);

    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'inference_id',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['inference_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'SET NULL',
      }),
    );

    const table = await queryRunner.getTable('trade');
    const decisionForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.length === 1 && fk.columnNames[0] === 'decision_id',
    );

    if (decisionForeignKey) {
      await queryRunner.dropForeignKey('trade', decisionForeignKey);
    }

    await queryRunner.dropColumn('trade', 'decision_id');
  }
}
