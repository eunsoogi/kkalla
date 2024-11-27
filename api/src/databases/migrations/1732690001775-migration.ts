import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1732690001775 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_roles_role',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'role_id',
            type: 'uuid',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_roles_role',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_roles_role',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'role',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        columnNames: ['role_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_roles_role');
    if (table) {
      const foreignKeys = table.foreignKeys;
      await Promise.all(foreignKeys.map((foreignKey) => queryRunner.dropForeignKey('user_roles_role', foreignKey)));
    }
    await queryRunner.dropTable('user_roles_role');
  }
}
