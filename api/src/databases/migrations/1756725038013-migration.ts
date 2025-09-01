import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class Migration1756725038013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('balance_recommendation');

    // rate 컬럼을 not null로 변경
    const oldRateColumn = table.findColumnByName('rate');
    const newRateColumn = new TableColumn({
      name: 'rate',
      type: 'double',
      default: 0,
    });

    await queryRunner.changeColumn('balance_recommendation', oldRateColumn, newRateColumn);

    // reason 컬럼을 nullable로 변경
    const oldReasonColumn = table.findColumnByName('reason');
    const newReasonColumn = new TableColumn({
      name: 'reason',
      type: 'text',
      isNullable: true,
    });

    await queryRunner.changeColumn('balance_recommendation', oldReasonColumn, newReasonColumn);

    // seq 컬럼의 중복 값 정리: created_at asc 순서로 seq 재부여
    const recommendations = await queryRunner.manager
      .createQueryBuilder()
      .select(['id', 'created_at'])
      .from('market_recommendation', 'mr')
      .orderBy('created_at', 'ASC')
      .getRawMany();

    // 순차적으로 seq 값 업데이트
    for (let i = 0; i < recommendations.length; i++) {
      await queryRunner.manager
        .createQueryBuilder()
        .update('market_recommendation')
        .set({ seq: i + 1 })
        .where('id = :id', { id: recommendations[i].id })
        .execute();
    }

    // seq 컬럼 유니크 인덱스 생성
    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('balance_recommendation');

    // rate 컬럼을 nullable로 변경
    const oldRateColumn = table.findColumnByName('rate');
    const newRateColumn = new TableColumn({
      name: 'rate',
      type: 'double',
      default: 0,
      isNullable: true,
    });

    await queryRunner.changeColumn('balance_recommendation', oldRateColumn, newRateColumn);

    // reason 컬럼을 not null로 변경
    const oldReasonColumn = table.findColumnByName('reason');
    const newReasonColumn = new TableColumn({
      name: 'reason',
      type: 'text',
      isNullable: false,
    });

    await queryRunner.changeColumn('balance_recommendation', oldReasonColumn, newReasonColumn);
  }
}
