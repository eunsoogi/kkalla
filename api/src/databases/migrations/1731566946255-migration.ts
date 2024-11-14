import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1731566946255 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inference_users_user',
        columns: [
          {
            name: 'inference_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['inference_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'inference',
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    const oldRecords = await queryRunner.manager
      .createQueryBuilder()
      .select(['id', 'user_id'])
      .from('inference', 'inference')
      .where('user_id IS NOT NULL')
      .getRawMany();

    if (oldRecords.length > 0) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('inference_users_user')
        .values(
          oldRecords.map((record) => ({
            inference_id: record.id,
            user_id: record.user_id,
          })),
        )
        .execute();
    }

    const foreignKeys = await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'inference'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
        AND tc.table_schema = DATABASE()
    `);

    if (foreignKeys && foreignKeys.length > 0) {
      const foreignKeyName = foreignKeys[0].constraint_name;
      await queryRunner.dropForeignKey('inference', foreignKeyName);
    }

    const indices = await queryRunner.query(`
      SHOW INDEX FROM inference
      WHERE Column_name = 'user_id'
        AND Key_name != 'PRIMARY'
        AND Key_name NOT LIKE 'FK%'
    `);

    if (indices && indices.length > 0) {
      await queryRunner.dropIndex('inference', indices[0].Key_name);
    }

    await queryRunner.dropColumn('inference', 'user_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inference',
      new TableColumn({
        name: 'user_id',
        type: 'double',
        isNullable: false,
      }),
    );

    const relations = await queryRunner.manager
      .createQueryBuilder()
      .select()
      .from('inference_users_user', 'relation')
      .getRawMany();

    for (const relation of relations) {
      await queryRunner.manager
        .createQueryBuilder()
        .update('inference')
        .set({ user_id: relation.user_id })
        .where('id = :id', { id: relation.inference_id })
        .execute();
    }

    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'inference',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.dropTable('inference_users_user');
  }
}
