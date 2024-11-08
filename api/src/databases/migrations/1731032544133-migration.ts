import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class Migration1731032544133 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'trade'
      AND constraint_type = 'FOREIGN KEY'
      AND column_name = 'inference_id'
    `);

    if (foreignKeys && foreignKeys.length > 0) {
      const foreignKeyName = foreignKeys[0].constraint_name;
      await queryRunner.dropForeignKey('trade', foreignKeyName);
    }

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'trade'
      AND constraint_type = 'FOREIGN KEY'
      AND column_name = 'inference_id'
    `);

    if (foreignKeys && foreignKeys.length > 0) {
      const foreignKeyName = foreignKeys[0].constraint_name;
      await queryRunner.dropForeignKey('trade', foreignKeyName);
    }

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );
  }
}
