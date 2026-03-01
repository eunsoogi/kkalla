import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import { AllocationAuditService } from './allocation-audit.service';
import {
  AllocationAuditItemSortBy,
  AllocationAuditRunItemPage,
  AllocationAuditRunPage,
  AllocationAuditRunSortBy,
  AllocationAuditSortOrder,
  AllocationAuditStatus,
  ReportType,
} from './allocation-audit.types';

@Controller('api/v1/allocation-audit')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
@RequirePermissions(Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT)
export class AllocationAuditController {
  constructor(private readonly allocationAuditService: AllocationAuditService) {}

  /**
   * Retrieves runs for the allocation audit flow.
   * @param limitRaw - Input value for limit raw.
   * @param pageRaw - Input value for page raw.
   * @param perPageRaw - Input value for per page raw.
   * @param sortByRaw - Input value for sort by raw.
   * @param sortOrderRaw - Input value for sort order raw.
   * @param includeSummaryRaw - Input value for include summary raw.
   * @param reportTypeRaw - Input value for report type raw.
   * @param statusRaw - Input value for status raw.
   * @returns Asynchronous result produced by the allocation audit flow.
   */
  @Get('runs')
  public async getRuns(
    @Query('limit') limitRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
    @Query('sortBy') sortByRaw?: string,
    @Query('sortOrder') sortOrderRaw?: string,
    @Query('includeSummary') includeSummaryRaw?: string,
    @Query('reportType') reportTypeRaw?: string,
    @Query('status') statusRaw?: string,
  ): Promise<AllocationAuditRunPage> {
    const reportType = this.parseReportType(reportTypeRaw);
    const status = this.parseStatus(statusRaw);
    const sortBy = this.parseRunSortBy(sortByRaw);
    const sortOrder = this.parseSortOrder(sortOrderRaw);
    const limit = this.parseLimit(limitRaw);
    const page = this.parseLimit(pageRaw);
    const perPage = this.parseLimit(perPageRaw);
    const includeSummary = this.parseBoolean(includeSummaryRaw);

    return this.allocationAuditService.getAuditRuns({
      limit,
      page,
      perPage,
      includeSummary,
      sortBy,
      sortOrder,
      reportType,
      status,
    });
  }

  /**
   * Retrieves run items for the allocation audit flow.
   * @param runId - Identifier for the target resource.
   * @param limitRaw - Input value for limit raw.
   * @param pageRaw - Input value for page raw.
   * @param perPageRaw - Input value for per page raw.
   * @param sortByRaw - Input value for sort by raw.
   * @param sortOrderRaw - Input value for sort order raw.
   * @param includeSummaryRaw - Input value for include summary raw.
   * @returns Asynchronous result produced by the allocation audit flow.
   */
  @Get('runs/:runId/items')
  public async getRunItems(
    @Param('runId') runId: string,
    @Query('limit') limitRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
    @Query('sortBy') sortByRaw?: string,
    @Query('sortOrder') sortOrderRaw?: string,
    @Query('includeSummary') includeSummaryRaw?: string,
  ): Promise<AllocationAuditRunItemPage> {
    const limit = this.parseLimit(limitRaw);
    const page = this.parseLimit(pageRaw);
    const perPage = this.parseLimit(perPageRaw);
    const sortBy = this.parseItemSortBy(sortByRaw);
    const sortOrder = this.parseSortOrder(sortOrderRaw);
    const includeSummary = this.parseBoolean(includeSummaryRaw);
    return this.allocationAuditService.getAuditRunItems(runId, {
      limit,
      page,
      perPage,
      includeSummary,
      sortBy,
      sortOrder,
    });
  }

  /**
   * Parses report type for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation audit flow.
   */
  private parseReportType(value?: string): ReportType | undefined {
    if (value === 'market' || value === 'allocation') {
      return value;
    }
    return undefined;
  }

  /**
   * Parses status for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation audit flow.
   */
  private parseStatus(value?: string): AllocationAuditStatus | undefined {
    if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
      return value;
    }
    return undefined;
  }

  /**
   * Parses limit for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Computed numeric value for the operation.
   */
  private parseLimit(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Parses run sort by for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation audit flow.
   */
  private parseRunSortBy(value?: string): AllocationAuditRunSortBy | undefined {
    if (value === 'createdAt' || value === 'completedAt' || value === 'overallScore' || value === 'status') {
      return value;
    }
    return undefined;
  }

  /**
   * Parses item sort by for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation audit flow.
   */
  private parseItemSortBy(value?: string): AllocationAuditItemSortBy | undefined {
    if (
      value === 'createdAt' ||
      value === 'evaluatedAt' ||
      value === 'returnPct' ||
      value === 'deterministicScore' ||
      value === 'aiScore' ||
      value === 'symbol' ||
      value === 'status' ||
      value === 'aiVerdict'
    ) {
      return value;
    }
    return undefined;
  }

  /**
   * Parses sort order for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Result produced by the allocation audit flow.
   */
  private parseSortOrder(value?: string): AllocationAuditSortOrder | undefined {
    if (value === 'asc' || value === 'desc') {
      return value;
    }
    return undefined;
  }

  /**
   * Parses boolean for the allocation audit flow.
   * @param value - Input value for value.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  private parseBoolean(value?: string): boolean {
    if (!value) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  }
}
