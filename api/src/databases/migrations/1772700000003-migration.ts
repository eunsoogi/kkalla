import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1772700000003 implements MigrationInterface {
  private readonly rateColumnsByTable: Record<string, string[]> = {
    allocation_recommendation: [
      'decision_confidence',
      'expected_volatility_pct',
      'expected_edge_rate',
      'estimated_cost_rate',
      'spread_rate',
      'impact_rate',
    ],
    // filled_ratio has been persisted as 0~1 fill fraction; do not rescale it.
    trade: ['expected_edge_rate', 'estimated_cost_rate', 'spread_rate', 'impact_rate'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries(this.rateColumnsByTable)) {
      for (const column of columns) {
        const exists = await queryRunner.hasColumn(table, column);
        if (!exists) {
          continue;
        }

        await queryRunner.query(
          `UPDATE \`${table}\` SET \`${column}\` = \`${column}\` / 100 WHERE \`${column}\` IS NOT NULL AND ABS(\`${column}\`) >= 1`,
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Data migration rollback is intentionally omitted to avoid re-scaling values that were already stored in 0~1.
  }
}
