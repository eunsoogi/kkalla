import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1757153357841 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('market_recommendation');

    // symbol 컬럼 길이 변경
    const oldSymbolColumn = table.findColumnByName('symbol');
    const newSymbolColumn = new TableColumn({
      name: 'symbol',
      type: 'varchar',
      length: '255',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldSymbolColumn, newSymbolColumn);

    // batch_id 컬럼 길이 변경
    const oldBatchIdColumn = table.findColumnByName('batch_id');
    const newBatchIdColumn = new TableColumn({
      name: 'batch_id',
      type: 'varchar',
      length: '255',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldBatchIdColumn, newBatchIdColumn);

    // created_at 컬럼을 datetime으로 변경
    const oldCreatedAtColumn = table.findColumnByName('created_at');
    const newRateColumn = new TableColumn({
      name: 'created_at',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldCreatedAtColumn, newRateColumn);

    // updated_at 컬럼을 datetime으로 변경
    const oldReasonColumn = table.findColumnByName('updated_at');
    const newReasonColumn = new TableColumn({
      name: 'updated_at',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      onUpdate: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldReasonColumn, newReasonColumn);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('market_recommendation');

    // created_at 컬럼을 timestamp으로 변경
    const oldCreatedAtColumn = table.findColumnByName('created_at');
    const newCreatedAtColumn = new TableColumn({
      name: 'created_at',
      type: 'timestamp',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldCreatedAtColumn, newCreatedAtColumn);

    // updated_at 컬럼을 timestamp으로 변경
    const oldUpdatedAtColumn = table.findColumnByName('updated_at');
    const newUpdatedAtColumn = new TableColumn({
      name: 'updated_at',
      type: 'timestamp',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      onUpdate: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    });

    await queryRunner.changeColumn('market_recommendation', oldUpdatedAtColumn, newUpdatedAtColumn);
  }
}
