import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1732584051433 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'decision',
      new TableColumn({
        name: 'decision_new',
        type: 'enum',
        enum: ['buy', 'hold', 'sell'],
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn('decision', 'decision', 'decision_old');

    await queryRunner.query(`
      UPDATE decision
      SET decision_new = LOWER(decision_old)
    `);

    await queryRunner.renameColumn('decision', 'decision_new', 'decision');
    await queryRunner.dropColumn('decision', 'decision_old');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'decision',
      new TableColumn({
        name: 'decision_new',
        type: 'enum',
        enum: ['BUY', 'HOLD', 'SELL'],
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn('decision', 'decision', 'decision_old');

    await queryRunner.query(`
      UPDATE decision
      SET decision_new = UPPER(decision_old)
    `);

    await queryRunner.renameColumn('decision', 'decision_new', 'decision');
    await queryRunner.dropColumn('decision', 'decision_old');
  }
}
