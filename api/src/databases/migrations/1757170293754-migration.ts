import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class Migration1757170293754 implements MigrationInterface {
  // 인덱스를 안전하게 재생성하는 헬퍼 함수
  private async recreateIndex(
    queryRunner: QueryRunner,
    tableName: string,
    columnNames: string[],
    newIndexName: string,
    isUnique: boolean = false,
  ): Promise<void> {
    // SQL 쿼리로 안전하게 기존 인덱스 드롭
    const columnNamesStr = columnNames.map((col) => `'${col}'`).join(',');
    const indices = await queryRunner.query(`
      SHOW INDEX FROM ${tableName}
      WHERE Column_name IN (${columnNamesStr})
        AND Key_name != 'PRIMARY'
        AND Key_name NOT LIKE 'FK%'
        AND Key_name != '${newIndexName}'
    `);

    if (indices && indices.length > 0) {
      // 중복되는 인덱스들을 드롭
      const uniqueIndexNames = [...new Set(indices.map((idx: any) => idx.Key_name))];
      for (const indexName of uniqueIndexNames) {
        try {
          await queryRunner.dropIndex(tableName, indexName as string);
        } catch (error) {
          // 인덱스가 이미 없거나 foreign key에 사용중인 경우 무시
          console.warn(`Failed to drop index ${indexName} on table ${tableName}:`, error);
        }
      }
    }

    // 새 인덱스 생성
    try {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({
          name: newIndexName,
          columnNames,
          isUnique,
        }),
      );
    } catch (error) {
      // 인덱스가 이미 존재하는 경우 무시
      console.warn(`Failed to create index ${newIndexName} on table ${tableName}:`, error);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 이름 없는 인덱스들을 drop하고 적절한 이름으로 재생성

    // role 테이블의 name 인덱스
    await this.recreateIndex(queryRunner, 'role', ['name'], 'idx_role_name');

    // trade 테이블의 seq 인덱스 (unique)
    await this.recreateIndex(queryRunner, 'trade', ['seq'], 'idx_trade_seq', true);

    // inference 테이블의 seq 인덱스 (unique)
    await this.recreateIndex(queryRunner, 'inference', ['seq'], 'idx_inference_seq', true);

    // user 테이블의 email 인덱스 (unique)
    await this.recreateIndex(queryRunner, 'user', ['email'], 'idx_user_email', true);

    // market_recommendation 테이블의 seq 인덱스 (unique)
    await this.recreateIndex(queryRunner, 'market_recommendation', ['seq'], 'idx_market_recommendation_seq', true);

    // notify 테이블의 seq 인덱스 (unique)
    await this.recreateIndex(queryRunner, 'notify', ['seq'], 'idx_notify_seq', true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 이름 있는 인덱스들을 drop하고 이름 없는 인덱스로 복원
    const indexesToDrop = [
      { table: 'role', name: 'idx_role_name', columns: ['name'], unique: false },
      { table: 'trade', name: 'idx_trade_seq', columns: ['seq'], unique: true },
      { table: 'inference', name: 'idx_inference_seq', columns: ['seq'], unique: true },
      { table: 'user', name: 'idx_user_email', columns: ['email'], unique: true },
      { table: 'market_recommendation', name: 'idx_market_recommendation_seq', columns: ['seq'], unique: true },
      { table: 'notify', name: 'idx_notify_seq', columns: ['seq'], unique: true },
    ];

    // 역순으로 인덱스 복원
    for (const { table, name, columns, unique } of indexesToDrop.reverse()) {
      try {
        await queryRunner.dropIndex(table, name);
        await queryRunner.createIndex(
          table,
          new TableIndex({
            columnNames: columns,
            isUnique: unique,
          }),
        );
      } catch (error) {
        // 인덱스가 존재하지 않을 수 있으므로 에러 무시
        console.warn(`Failed to rollback index ${name} on table ${table}:`, error);
      }
    }
  }
}
