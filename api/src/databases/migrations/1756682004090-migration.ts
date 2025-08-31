import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1756682004090 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'market_recommendation',
      new TableColumn({
        name: 'seq',
        type: 'bigint',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('market_recommendation', 'seq');
  }
}
