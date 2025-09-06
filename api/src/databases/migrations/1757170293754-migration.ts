import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class Migration1757170293754 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 이름 없는 인덱스들을 drop하고 적절한 이름으로 재생성

    // 1. upbit_config 테이블의 user_id 인덱스 (unique)
    const upbitIndexes = await queryRunner.query(
      "SHOW INDEX FROM upbit_config WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    if (upbitIndexes.length > 0) {
      await queryRunner.dropIndex('upbit_config', upbitIndexes[0].Key_name);
    }
    await queryRunner.createIndex(
      'upbit_config',
      new TableIndex({
        name: 'idx_upbit_config_user',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 2. role 테이블의 name 인덱스
    const roleIndexes = await queryRunner.query(
      "SHOW INDEX FROM role WHERE Column_name = 'name' AND Key_name != 'PRIMARY'",
    );
    if (roleIndexes.length > 0) {
      await queryRunner.dropIndex('role', roleIndexes[0].Key_name);
    }
    await queryRunner.createIndex(
      'role',
      new TableIndex({
        name: 'idx_role_name',
        columnNames: ['name'],
      }),
    );

    // 3. trade 테이블의 inference_id 인덱스들
    const tradeInferenceIndexes = await queryRunner.query(
      "SHOW INDEX FROM trade WHERE Column_name = 'inference_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of tradeInferenceIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('trade', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        name: 'idx_trade_inference',
        columnNames: ['inference_id'],
      }),
    );

    // 4. trade 테이블의 user_id 인덱스
    const tradeUserIndexes = await queryRunner.query(
      "SHOW INDEX FROM trade WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of tradeUserIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('trade', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        name: 'idx_trade_user',
        columnNames: ['user_id'],
      }),
    );

    // 5. trade 테이블의 seq 인덱스 (unique)
    const tradeSeqIndexes = await queryRunner.query(
      "SHOW INDEX FROM trade WHERE Column_name = 'seq' AND Key_name != 'PRIMARY'",
    );
    for (const index of tradeSeqIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('trade', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        name: 'idx_trade_seq',
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 6. trade 테이블의 decision_id 인덱스
    const tradeDecisionIndexes = await queryRunner.query(
      "SHOW INDEX FROM trade WHERE Column_name = 'decision_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of tradeDecisionIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('trade', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        name: 'idx_trade_decision',
        columnNames: ['decision_id'],
      }),
    );

    // 7. inference 테이블의 user_id 인덱스
    const inferenceUserIndexes = await queryRunner.query(
      "SHOW INDEX FROM inference WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of inferenceUserIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('inference', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        name: 'idx_inference_user',
        columnNames: ['user_id'],
      }),
    );

    // 8. inference 테이블의 seq 인덱스 (unique)
    const inferenceSeqIndexes = await queryRunner.query(
      "SHOW INDEX FROM inference WHERE Column_name = 'seq' AND Key_name != 'PRIMARY'",
    );
    for (const index of inferenceSeqIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('inference', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        name: 'idx_inference_seq',
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 9. user 테이블의 email 인덱스 (unique)
    const userEmailIndexes = await queryRunner.query(
      "SHOW INDEX FROM user WHERE Column_name = 'email' AND Key_name != 'PRIMARY'",
    );
    for (const index of userEmailIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('user', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'idx_user_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // 10. slack_config 테이블의 user_id 인덱스 (unique)
    const slackConfigIndexes = await queryRunner.query(
      "SHOW INDEX FROM slack_config WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of slackConfigIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('slack_config', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'slack_config',
      new TableIndex({
        name: 'idx_slack_config_user',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 11. schedule 테이블의 user_id 인덱스 (unique)
    const scheduleIndexes = await queryRunner.query(
      "SHOW INDEX FROM schedule WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of scheduleIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('schedule', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'schedule',
      new TableIndex({
        name: 'idx_schedule_user',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 12. market_recommendation 테이블의 seq 인덱스 (unique)
    const marketSeqIndexes = await queryRunner.query(
      "SHOW INDEX FROM market_recommendation WHERE Column_name = 'seq' AND Key_name != 'PRIMARY'",
    );
    for (const index of marketSeqIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('market_recommendation', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_seq',
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 13. notify 테이블의 user_id 인덱스
    const notifyUserIndexes = await queryRunner.query(
      "SHOW INDEX FROM notify WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY' AND Key_name != 'idx_notify_user_seq'",
    );
    for (const index of notifyUserIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('notify', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        name: 'idx_notify_user',
        columnNames: ['user_id'],
      }),
    );

    // 14. notify 테이블의 seq 인덱스 (unique)
    const notifySeqIndexes = await queryRunner.query(
      "SHOW INDEX FROM notify WHERE Column_name = 'seq' AND Key_name != 'PRIMARY' AND Key_name != 'idx_notify_user_seq'",
    );
    for (const index of notifySeqIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('UQ_')) {
        await queryRunner.dropIndex('notify', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        name: 'idx_notify_seq',
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 15. user_roles_role 테이블 인덱스들
    const userRoleUserIndexes = await queryRunner.query(
      "SHOW INDEX FROM user_roles_role WHERE Column_name = 'user_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of userRoleUserIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('user_roles_role', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        name: 'idx_user_roles_role_user',
        columnNames: ['user_id'],
      }),
    );

    const userRoleRoleIndexes = await queryRunner.query(
      "SHOW INDEX FROM user_roles_role WHERE Column_name = 'role_id' AND Key_name != 'PRIMARY'",
    );
    for (const index of userRoleRoleIndexes) {
      if (index.Key_name.startsWith('IDX_') || index.Key_name.startsWith('FK_')) {
        await queryRunner.dropIndex('user_roles_role', index.Key_name);
      }
    }
    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        name: 'idx_user_roles_role_role',
        columnNames: ['role_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: 이름 있는 인덱스들을 drop하고 이름 없는 인덱스로 복원
    // 1. upbit_config
    await queryRunner.dropIndex('upbit_config', 'idx_upbit_config_user');
    await queryRunner.createIndex(
      'upbit_config',
      new TableIndex({
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 2. role
    await queryRunner.dropIndex('role', 'idx_role_name');
    await queryRunner.createIndex(
      'role',
      new TableIndex({
        columnNames: ['name'],
      }),
    );

    // 3-6. trade 인덱스들
    await queryRunner.dropIndex('trade', 'idx_trade_inference');
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['inference_id'],
      }),
    );

    await queryRunner.dropIndex('trade', 'idx_trade_user');
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.dropIndex('trade', 'idx_trade_seq');
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    await queryRunner.dropIndex('trade', 'idx_trade_decision');
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['decision_id'],
      }),
    );

    // 7-8. inference 인덱스들
    await queryRunner.dropIndex('inference', 'idx_inference_user');
    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.dropIndex('inference', 'idx_inference_seq');
    await queryRunner.createIndex(
      'inference',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 9. user
    await queryRunner.dropIndex('user', 'idx_user_email');
    await queryRunner.createIndex(
      'user',
      new TableIndex({
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // 10. slack_config
    await queryRunner.dropIndex('slack_config', 'idx_slack_config_user');
    await queryRunner.createIndex(
      'slack_config',
      new TableIndex({
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 11. schedule
    await queryRunner.dropIndex('schedule', 'idx_schedule_user');
    await queryRunner.createIndex(
      'schedule',
      new TableIndex({
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );

    // 12. market_recommendation
    await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_seq');
    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 13-14. notify 인덱스들
    await queryRunner.dropIndex('notify', 'idx_notify_user');
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.dropIndex('notify', 'idx_notify_seq');
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    // 15. user_roles_role
    await queryRunner.dropIndex('user_roles_role', 'idx_user_roles_role_user');
    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.dropIndex('user_roles_role', 'idx_user_roles_role_role');
    await queryRunner.createIndex(
      'user_roles_role',
      new TableIndex({
        columnNames: ['role_id'],
      }),
    );
  }
}
