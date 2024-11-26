import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1732584051433 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'decision',
      'decision',
      new TableColumn({
        name: 'decision',
        type: 'enum',
        enum: ['buy', 'hold', 'sell'],
        isNullable: false,
      }),
    );

    await queryRunner.query(`
      UPDATE decision
      SET decision = LOWER(decision)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'decision',
      'decision',
      new TableColumn({
        name: 'decision',
        type: 'enum',
        enum: ['BUY', 'HOLD', 'SELL'],
        isNullable: false,
      }),
    );
  }
}
