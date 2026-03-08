import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1772901200000 implements MigrationInterface {
  name = 'Migration1772901200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`trade_cost_calibration_snapshot\` (
        \`id\` varchar(26) NOT NULL,
        \`version\` int NOT NULL,
        \`category\` enum('coin_major','coin_minor','nasdaq') NOT NULL,
        \`cost_tier\` varchar(16) NOT NULL,
        \`position_class\` varchar(16) NOT NULL,
        \`regime_source\` varchar(32) NOT NULL,
        \`sample_size\` int NOT NULL,
        \`window_start\` datetime NOT NULL,
        \`window_end\` datetime NOT NULL,
        \`last_trade_at\` datetime NOT NULL,
        \`raw_multiplier\` double NOT NULL,
        \`applied_multiplier\` double NOT NULL,
        \`clamp_applied\` tinyint NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`idx_trade_cost_calibration_snapshot_bucket\` (
          \`version\`,
          \`category\`,
          \`cost_tier\`,
          \`position_class\`,
          \`regime_source\`
        ),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `trade_cost_calibration_snapshot`');
  }
}
