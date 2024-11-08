import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class Migration1731032544133 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'trade'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'inference_id'
        AND tc.table_schema = DATABASE()
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
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'trade'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'inference_id'
        AND tc.table_schema = DATABASE()
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
