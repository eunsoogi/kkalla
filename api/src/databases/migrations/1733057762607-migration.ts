import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1733057762607 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('inference', [
      new TableColumn({
        name: 'category',
        type: 'enum',
        enum: ['coin_major', 'coin_minor', 'nasdaq'],
        isNullable: true,
      }),
      new TableColumn({
        name: 'ticker',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'reason',
        type: 'text',
        isNullable: true,
      }),
    ]);

    await queryRunner.query('UPDATE inference SET category = "coin_major"');
    await queryRunner.query('UPDATE inference SET ticker = symbol');
    await queryRunner.query(`
      UPDATE inference
      SET reason = (
        SELECT reason
        FROM decision
        WHERE decision.inference_id = inference.id
        ORDER BY decision.created_at ASC
        LIMIT 1
      )
    `);

    await queryRunner.changeColumn(
      'inference',
      'category',
      new TableColumn({
        name: 'category',
        type: 'enum',
        enum: ['coin_major', 'coin_minor', 'nasdaq'],
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'inference',
      'ticker',
      new TableColumn({
        name: 'ticker',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'inference',
      'reason',
      new TableColumn({
        name: 'reason',
        type: 'text',
        isNullable: false,
      }),
    );

    await queryRunner.dropColumn('inference', 'symbol');
    await queryRunner.dropColumn('decision', 'reason');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'decision',
      new TableColumn({
        name: 'reason',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE decision d
      INNER JOIN inference i ON d.inference_id = i.id
      SET d.reason = i.reason
    `);

    await queryRunner.changeColumn(
      'decision',
      'reason',
      new TableColumn({
        name: 'reason',
        type: 'text',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'inference',
      new TableColumn({
        name: 'symbol',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.query('UPDATE inference SET symbol = ticker');

    await queryRunner.changeColumn(
      'inference',
      'symbol',
      new TableColumn({
        name: 'symbol',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );

    await queryRunner.dropColumns('inference', ['category', 'ticker', 'reason']);
  }
}
