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

  private buildRescaleCondition(column: string, columns: string[], alias: string): string {
    const qualifiedColumn = `\`${alias}\`.\`${column}\``;
    const legacySiblingColumns = columns.filter((item) => item !== column);
    if (legacySiblingColumns.length === 0) {
      return `ABS(${qualifiedColumn}) > 1`;
    }

    const legacySiblingCondition = legacySiblingColumns.map((item) => `ABS(\`${alias}\`.\`${item}\`) > 1`).join(' OR ');

    // Keep already-normalized boundary(1/-1) values unless the same row clearly contains legacy (>1) rate columns.
    return `(ABS(${qualifiedColumn}) > 1 OR (ABS(${qualifiedColumn}) = 1 AND (${legacySiblingCondition})))`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, configuredColumns] of Object.entries(this.rateColumnsByTable)) {
      const existingColumns: string[] = [];
      for (const column of configuredColumns) {
        const exists = await queryRunner.hasColumn(table, column);
        if (exists) {
          existingColumns.push(column);
        }
      }

      if (existingColumns.length === 0) {
        continue;
      }

      const setClause = existingColumns
        .map((column) => {
          const rescaleCondition = this.buildRescaleCondition(column, existingColumns, 'source');
          return `\`current\`.\`${column}\` = CASE WHEN \`source\`.\`${column}\` IS NOT NULL AND ${rescaleCondition} THEN \`source\`.\`${column}\` / 100 ELSE \`source\`.\`${column}\` END`;
        })
        .join(', ');

      const whereClause = existingColumns
        .map((column) => {
          const rescaleCondition = this.buildRescaleCondition(column, existingColumns, 'source');
          return `(\`source\`.\`${column}\` IS NOT NULL AND ${rescaleCondition})`;
        })
        .join(' OR ');

      await queryRunner.query(
        `UPDATE \`${table}\` \`current\` INNER JOIN \`${table}\` \`source\` ON \`source\`.\`id\` = \`current\`.\`id\` SET ${setClause} WHERE ${whereClause}`,
      );
    }
  }

  public async down(): Promise<void> {
    // Data migration rollback is intentionally omitted to avoid re-scaling values that were already stored in 0~1.
  }
}
