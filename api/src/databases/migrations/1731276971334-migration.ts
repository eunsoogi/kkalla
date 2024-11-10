import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration11731276971334 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'notify',
      'message',
      new TableColumn({
        name: 'message',
        type: 'text',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'notify',
      'message',
      new TableColumn({
        name: 'message',
        type: 'varchar',
        length: '255',
      }),
    );
  }
}
