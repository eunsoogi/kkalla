import { MigrationInterface, QueryRunner } from 'typeorm';

interface PermissionRename {
  from: string;
  to: string;
}

export class Migration1772300000000 implements MigrationInterface {
  private readonly permissionRenames: PermissionRename[] = [
    {
      from: 'exec:schedule:balance_recommendation_new',
      to: 'exec:schedule:allocation_recommendation_new',
    },
    {
      from: 'exec:schedule:balance_recommendation_existing',
      to: 'exec:schedule:allocation_recommendation_existing',
    },
    {
      from: 'exec:schedule:report_validation',
      to: 'exec:schedule:allocation_audit',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.renameTableIfNeeded(queryRunner, 'balance_recommendation', 'allocation_recommendation');
    await this.renameTableIfNeeded(queryRunner, 'market_recommendation', 'market_signal');
    await this.renameTableIfNeeded(queryRunner, 'history', 'holding_ledger');
    await this.renameTableIfNeeded(queryRunner, 'report_validation_run', 'allocation_audit_run');
    await this.renameTableIfNeeded(queryRunner, 'report_validation_item', 'allocation_audit_item');
    await this.migrateReportTypeToAllocation(queryRunner, 'allocation_audit_run');
    await this.migrateReportTypeToAllocation(queryRunner, 'allocation_audit_item');

    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_batch_id_symbol',
      'idx_allocation_recommendation_batch_id_symbol',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_symbol',
      'idx_allocation_recommendation_symbol',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_category_seq',
      'idx_allocation_recommendation_category_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_category_symbol_seq',
      'idx_allocation_recommendation_category_symbol_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_category_created_at',
      'idx_allocation_recommendation_category_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_category_symbol_created_at',
      'idx_allocation_recommendation_category_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_balance_recommendation_seq',
      'idx_allocation_recommendation_seq',
    );

    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_recommendation_batch_id',
      'idx_market_signal_batch_id',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_recommendation_symbol_seq',
      'idx_market_signal_symbol_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_recommendation_symbol_created_at',
      'idx_market_signal_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_recommendation_created_at',
      'idx_market_signal_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_recommendation_seq',
      'idx_market_signal_seq',
    );

    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_run',
      'idx_report_validation_run_report_type_batch_horizon',
      'idx_allocation_audit_run_report_type_batch_horizon',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_report_validation_item_source_recommendation_horizon',
      'idx_allocation_audit_item_source_recommendation_horizon',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_report_validation_item_status_due_at',
      'idx_allocation_audit_item_status_due_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_report_validation_item_report_type_symbol_created_at',
      'idx_allocation_audit_item_report_type_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_report_validation_item_source_batch_horizon',
      'idx_allocation_audit_item_source_batch_horizon',
    );

    await this.updateTradeExecutionModuleValue(queryRunner, 'rebalance', 'allocation');
    await this.updateTradeExecutionModuleValue(queryRunner, 'volatility', 'risk');

    for (const rename of this.permissionRenames) {
      await this.renameRolePermission(queryRunner, rename.from, rename.to);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const rename of [...this.permissionRenames].reverse()) {
      await this.renameRolePermission(queryRunner, rename.to, rename.from);
    }

    await this.updateTradeExecutionModuleValue(queryRunner, 'allocation', 'rebalance');
    await this.updateTradeExecutionModuleValue(queryRunner, 'risk', 'volatility');
    await this.migrateReportTypeToPortfolio(queryRunner, 'allocation_audit_run');
    await this.migrateReportTypeToPortfolio(queryRunner, 'allocation_audit_item');

    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_allocation_audit_item_source_batch_horizon',
      'idx_report_validation_item_source_batch_horizon',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_allocation_audit_item_report_type_symbol_created_at',
      'idx_report_validation_item_report_type_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_allocation_audit_item_status_due_at',
      'idx_report_validation_item_status_due_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_item',
      'idx_allocation_audit_item_source_recommendation_horizon',
      'idx_report_validation_item_source_recommendation_horizon',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_audit_run',
      'idx_allocation_audit_run_report_type_batch_horizon',
      'idx_report_validation_run_report_type_batch_horizon',
    );

    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_signal_seq',
      'idx_market_recommendation_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_signal_created_at',
      'idx_market_recommendation_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_signal_symbol_created_at',
      'idx_market_recommendation_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_signal_symbol_seq',
      'idx_market_recommendation_symbol_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'market_signal',
      'idx_market_signal_batch_id',
      'idx_market_recommendation_batch_id',
    );

    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_seq',
      'idx_balance_recommendation_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_category_symbol_created_at',
      'idx_balance_recommendation_category_symbol_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_category_created_at',
      'idx_balance_recommendation_category_created_at',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_category_symbol_seq',
      'idx_balance_recommendation_category_symbol_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_category_seq',
      'idx_balance_recommendation_category_seq',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_symbol',
      'idx_balance_recommendation_symbol',
    );
    await this.renameIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_batch_id_symbol',
      'idx_balance_recommendation_batch_id_symbol',
    );

    await this.renameTableIfNeeded(queryRunner, 'allocation_audit_item', 'report_validation_item');
    await this.renameTableIfNeeded(queryRunner, 'allocation_audit_run', 'report_validation_run');
    await this.renameTableIfNeeded(queryRunner, 'holding_ledger', 'history');
    await this.renameTableIfNeeded(queryRunner, 'market_signal', 'market_recommendation');
    await this.renameTableIfNeeded(queryRunner, 'allocation_recommendation', 'balance_recommendation');
  }

  private async renameTableIfNeeded(queryRunner: QueryRunner, fromTable: string, toTable: string): Promise<void> {
    const hasFrom = await queryRunner.hasTable(fromTable);
    const hasTo = await queryRunner.hasTable(toTable);

    if (hasFrom && !hasTo) {
      await queryRunner.renameTable(fromTable, toTable);
    }
  }

  private async migrateReportTypeToAllocation(queryRunner: QueryRunner, tableName: string): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`report_type\` ENUM('market','portfolio','allocation') NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE \`${tableName}\` SET \`report_type\` = 'allocation' WHERE \`report_type\` = 'portfolio'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`report_type\` ENUM('market','allocation') NOT NULL`,
    );
  }

  private async migrateReportTypeToPortfolio(queryRunner: QueryRunner, tableName: string): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`report_type\` ENUM('market','portfolio','allocation') NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE \`${tableName}\` SET \`report_type\` = 'portfolio' WHERE \`report_type\` = 'allocation'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`report_type\` ENUM('market','portfolio') NOT NULL`,
    );
  }

  private async renameIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    oldIndexName: string,
    newIndexName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const oldIndex = table.indices.find((index) => index.name === oldIndexName);
    const newIndex = table.indices.find((index) => index.name === newIndexName);

    if (!oldIndex || newIndex) {
      return;
    }

    await queryRunner.query(`ALTER TABLE \`${tableName}\` RENAME INDEX \`${oldIndexName}\` TO \`${newIndexName}\``);
  }

  private async updateTradeExecutionModuleValue(
    queryRunner: QueryRunner,
    fromValue: string,
    toValue: string,
  ): Promise<void> {
    const hasLedgerTable = await queryRunner.hasTable('trade_execution_ledger');
    if (!hasLedgerTable) {
      return;
    }

    await queryRunner.query(`UPDATE trade_execution_ledger SET module = ? WHERE module = ?`, [toValue, fromValue]);
  }

  private async renameRolePermission(queryRunner: QueryRunner, from: string, to: string): Promise<void> {
    const hasRoleTable = await queryRunner.hasTable('role');
    if (!hasRoleTable) {
      return;
    }

    await queryRunner.query(
      `
      UPDATE role
      SET permissions = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', permissions, ','), ?, ?))
      WHERE permissions IS NOT NULL
        AND permissions <> ''
        AND CONCAT(',', permissions, ',') LIKE ?
    `,
      [`,${from},`, `,${to},`, `%,${from},%`],
    );
  }
}
