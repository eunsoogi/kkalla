import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../permission/permission.enum';
import {
  ReportType,
  ReportValidationItemSortBy,
  ReportValidationRunItemPage,
  ReportValidationRunPage,
  ReportValidationRunSortBy,
  ReportValidationSortOrder,
  ReportValidationStatus,
} from './report-validation.interface';
import { ReportValidationService } from './report-validation.service';

@Controller('api/v1/report-validation')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
@RequirePermissions(Permission.EXEC_SCHEDULE_REPORT_VALIDATION)
export class ReportValidationController {
  constructor(private readonly reportValidationService: ReportValidationService) {}

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
  ): Promise<ReportValidationRunPage> {
    const reportType = this.parseReportType(reportTypeRaw);
    const status = this.parseStatus(statusRaw);
    const sortBy = this.parseRunSortBy(sortByRaw);
    const sortOrder = this.parseSortOrder(sortOrderRaw);
    const limit = this.parseLimit(limitRaw);
    const page = this.parseLimit(pageRaw);
    const perPage = this.parseLimit(perPageRaw);
    const includeSummary = this.parseBoolean(includeSummaryRaw);

    return this.reportValidationService.getValidationRuns({
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

  @Get('runs/:runId/items')
  public async getRunItems(
    @Param('runId') runId: string,
    @Query('limit') limitRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('perPage') perPageRaw?: string,
    @Query('sortBy') sortByRaw?: string,
    @Query('sortOrder') sortOrderRaw?: string,
    @Query('includeSummary') includeSummaryRaw?: string,
  ): Promise<ReportValidationRunItemPage> {
    const limit = this.parseLimit(limitRaw);
    const page = this.parseLimit(pageRaw);
    const perPage = this.parseLimit(perPageRaw);
    const sortBy = this.parseItemSortBy(sortByRaw);
    const sortOrder = this.parseSortOrder(sortOrderRaw);
    const includeSummary = this.parseBoolean(includeSummaryRaw);
    return this.reportValidationService.getValidationRunItems(runId, {
      limit,
      page,
      perPage,
      includeSummary,
      sortBy,
      sortOrder,
    });
  }

  private parseReportType(value?: string): ReportType | undefined {
    if (value === 'market' || value === 'portfolio') {
      return value;
    }
    return undefined;
  }

  private parseStatus(value?: string): ReportValidationStatus | undefined {
    if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
      return value;
    }
    return undefined;
  }

  private parseLimit(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseRunSortBy(value?: string): ReportValidationRunSortBy | undefined {
    if (
      value === 'createdAt' ||
      value === 'completedAt' ||
      value === 'overallScore' ||
      value === 'status' ||
      value === 'seq'
    ) {
      return value;
    }
    return undefined;
  }

  private parseItemSortBy(value?: string): ReportValidationItemSortBy | undefined {
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

  private parseSortOrder(value?: string): ReportValidationSortOrder | undefined {
    if (value === 'asc' || value === 'desc') {
      return value;
    }
    return undefined;
  }

  private parseBoolean(value?: string): boolean {
    if (!value) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  }
}
