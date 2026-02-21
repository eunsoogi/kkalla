'use client';

import React, { useMemo, useState } from 'react';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useQuery } from '@tanstack/react-query';
import { Badge, Label, Select, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { getReportValidationRunItemsAction, getReportValidationRunsAction } from '@/components/report-validation/action';
import { Permission } from '@/interfaces/permission.interface';
import {
  ReportValidationItemSortBy,
  ReportType,
  ReportValidationItem,
  ReportValidationItemPage,
  ReportValidationRunSortBy,
  ReportValidationRun,
  ReportValidationRunPage,
  ReportValidationSortOrder,
  ReportValidationStatus,
  ReportValidationVerdict,
} from '@/interfaces/report-validation.interface';
import { formatDate } from '@/utils/date';

const formatSignedPercent = (value: number | null | undefined, digits = 2): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
};

const formatScore = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return `${(value * 100).toFixed(0)}%`;
};

const scoreClassName = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return 'text-gray-500 dark:text-gray-400';
  }
  if (value >= 0.7) return 'text-green-600 dark:text-green-400';
  if (value >= 0.5) return 'text-yellow-600 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
};

const returnClassName = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return 'text-gray-500 dark:text-gray-400';
  }
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-300';
};

const toBadgeColor = (status: ReportValidationStatus, verdict: ReportValidationVerdict | null) => {
  if (status === 'failed') return 'failure';
  if (status === 'running') return 'warning';
  if (status === 'pending') return 'gray';
  if (verdict === 'bad') return 'failure';
  if (verdict === 'mixed') return 'warning';
  if (verdict === 'good') return 'success';
  return 'info';
};

const statusLabel = (t: ReturnType<typeof useTranslations>, status: ReportValidationStatus): string => {
  return t(`reportValidation.status.${status}`);
};

const verdictLabel = (t: ReturnType<typeof useTranslations>, verdict: ReportValidationVerdict | null): string => {
  if (!verdict) return '-';
  return t(`reportValidation.verdict.${verdict}`);
};

const calculateItemOverallScore = (item: ReportValidationItem): number | null => {
  if (typeof item.deterministicScore === 'number' && typeof item.aiScore === 'number') {
    return 0.6 * item.deterministicScore + 0.4 * item.aiScore;
  }

  if (typeof item.deterministicScore === 'number') {
    return item.deterministicScore;
  }

  if (typeof item.aiScore === 'number') {
    return item.aiScore;
  }

  return null;
};

const Page: React.FC = () => {
  const RUNS_PER_PAGE = 20;
  const ITEMS_PER_PAGE = 50;
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations();
  const permissions = session?.permissions ?? [];
  const hasReportValidationAccess = permissions.includes(Permission.EXEC_SCHEDULE_REPORT_VALIDATION);
  const canLoadReportValidationData = sessionStatus === 'authenticated' && hasReportValidationAccess;
  const [reportType, setReportType] = useState<'all' | ReportType>('all');
  const [status, setStatus] = useState<'all' | ReportValidationStatus>('all');
  const [runsSortBy, setRunsSortBy] = useState<ReportValidationRunSortBy>('seq');
  const [runsSortOrder, setRunsSortOrder] = useState<ReportValidationSortOrder>('desc');
  const [runsPage, setRunsPage] = useState(1);
  const [itemsSortBy, setItemsSortBy] = useState<ReportValidationItemSortBy>('evaluatedAt');
  const [itemsSortOrder, setItemsSortOrder] = useState<ReportValidationSortOrder>('desc');
  const [itemsPage, setItemsPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const { data: runsData, isLoading: isRunsLoading } = useQuery<ReportValidationRunPage>({
    queryKey: ['report-validation', 'runs', reportType, status, runsPage, runsSortBy, runsSortOrder],
    queryFn: () =>
      getReportValidationRunsAction({
        reportType,
        status,
        page: runsPage,
        perPage: RUNS_PER_PAGE,
        sortBy: runsSortBy,
        sortOrder: runsSortOrder,
        includeSummary: true,
      }),
    enabled: canLoadReportValidationData,
  });
  const runs: ReportValidationRun[] = useMemo(() => runsData?.items ?? [], [runsData]);

  const activeRunId = useMemo(() => {
    if (runs.length < 1) {
      return '';
    }

    const exists = runs.some((run) => run.id === selectedRunId);
    return exists ? selectedRunId : runs[0].id;
  }, [runs, selectedRunId]);

  const selectedRun = useMemo(() => runs.find((run) => run.id === activeRunId), [runs, activeRunId]);

  const { data: itemsData, isLoading: isItemsLoading } = useQuery<ReportValidationItemPage>({
    queryKey: ['report-validation', 'run-items', activeRunId, itemsPage, itemsSortBy, itemsSortOrder],
    queryFn: () =>
      getReportValidationRunItemsAction(activeRunId, {
        page: itemsPage,
        perPage: ITEMS_PER_PAGE,
        sortBy: itemsSortBy,
        sortOrder: itemsSortOrder,
        includeSummary: true,
      }),
    enabled: canLoadReportValidationData && !!activeRunId,
  });
  const items: ReportValidationItem[] = useMemo(() => itemsData?.items ?? [], [itemsData]);

  const summaryStats = useMemo(() => {
    if (runsData?.summary) {
      return runsData.summary;
    }

    const pendingOrRunning = runs.filter((run) => run.status === 'pending' || run.status === 'running').length;
    const completed = runs.filter((run) => run.status === 'completed').length;
    const scores = runs
      .map((run) => run.overallScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

    return {
      totalRuns: runsData?.total ?? 0,
      pendingOrRunning,
      completed,
      avgScore,
      recommendedMarketMinConfidenceForPortfolio: null,
    };
  }, [runsData, runs]);

  const itemStats = useMemo(() => {
    if (itemsData?.summary) {
      return itemsData.summary;
    }

    const validItems = items.filter((item) => item.aiVerdict !== 'invalid');
    const invalidCount = items.filter((item) => item.aiVerdict === 'invalid').length;

    const scores = validItems
      .map((item) => calculateItemOverallScore(item))
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const avgItemScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

    const returns = validItems
      .map((item) => item.returnPct)
      .filter((ret): ret is number => typeof ret === 'number' && Number.isFinite(ret));
    const avgReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : null;

    const verdictGood = validItems.filter((item) => item.aiVerdict === 'good').length;
    const verdictMixed = validItems.filter((item) => item.aiVerdict === 'mixed').length;
    const verdictBad = validItems.filter((item) => item.aiVerdict === 'bad').length;

    return {
      itemCount: items.length,
      invalidCount,
      avgItemScore,
      avgReturn,
      verdictGood,
      verdictMixed,
      verdictBad,
    };
  }, [itemsData, items]);

  const sortIndicator = (active: boolean, order: ReportValidationSortOrder): string => {
    if (!active) return '↕';
    return order === 'asc' ? '↑' : '↓';
  };

  const handleRunsSort = (nextSortBy: ReportValidationRunSortBy): void => {
    const nextOrder: ReportValidationSortOrder =
      runsSortBy === nextSortBy ? (runsSortOrder === 'desc' ? 'asc' : 'desc') : 'desc';

    setRunsSortBy(nextSortBy);
    setRunsSortOrder(nextOrder);
    setRunsPage(1);
    setItemsPage(1);
    setSelectedRunId('');
  };

  const handleItemsSort = (nextSortBy: ReportValidationItemSortBy): void => {
    const nextOrder: ReportValidationSortOrder =
      itemsSortBy === nextSortBy ? (itemsSortOrder === 'desc' ? 'asc' : 'desc') : 'desc';

    setItemsSortBy(nextSortBy);
    setItemsSortOrder(nextOrder);
    setItemsPage(1);
  };

  return (
    <PermissionGuard permissions={[Permission.EXEC_SCHEDULE_REPORT_VALIDATION]} fallback={<ForbiddenError />}>
      <div className='space-y-6'>
        <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>{t('reportValidation.title')}</h1>
          <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>{t('reportValidation.description')}</p>

          <div className='mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5'>
            <div className='rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.stats.totalRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-gray-900 dark:text-white'>{summaryStats.totalRuns}</p>
            </div>
            <div className='rounded-lg border border-amber-300/50 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-500/40 px-4 py-3'>
              <p className='text-xs text-amber-700 dark:text-amber-300'>{t('reportValidation.stats.activeRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-amber-800 dark:text-amber-200'>
                {summaryStats.pendingOrRunning}
              </p>
            </div>
            <div className='rounded-lg border border-green-300/50 bg-green-50/40 dark:bg-green-900/10 dark:border-green-500/40 px-4 py-3'>
              <p className='text-xs text-green-700 dark:text-green-300'>{t('reportValidation.stats.completedRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-green-800 dark:text-green-200'>{summaryStats.completed}</p>
            </div>
            <div className='rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.stats.avgScore')}</p>
              <p className={`mt-1 text-xl font-semibold ${scoreClassName(summaryStats.avgScore)}`}>
                {formatScore(summaryStats.avgScore)}
              </p>
            </div>
            <div className='rounded-lg border border-blue-300/40 bg-blue-50/40 dark:bg-blue-900/10 dark:border-blue-500/40 px-4 py-3'>
              <p className='text-xs text-blue-700 dark:text-blue-300'>
                {t('reportValidation.stats.recommendedMinConfidence')}
              </p>
              <p className='mt-1 text-xl font-semibold text-blue-800 dark:text-blue-200'>
                {formatScore(summaryStats.recommendedMarketMinConfidenceForPortfolio)}
              </p>
            </div>
          </div>

          <div className='mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[260px_260px_1fr]'>
            <div className='min-w-0'>
              <Label htmlFor='reportType'>{t('reportValidation.filters.reportType')}</Label>
              <Select
                id='reportType'
                value={reportType}
                onChange={(event) => {
                  setReportType(event.target.value as 'all' | ReportType);
                  setRunsPage(1);
                  setItemsPage(1);
                  setSelectedRunId('');
                }}
              >
                <option value='all'>{t('reportValidation.filters.all')}</option>
                <option value='market'>{t('reportValidation.type.market')}</option>
                <option value='portfolio'>{t('reportValidation.type.portfolio')}</option>
              </Select>
            </div>

            <div className='min-w-0'>
              <Label htmlFor='status'>{t('reportValidation.filters.status')}</Label>
              <Select
                id='status'
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as 'all' | ReportValidationStatus);
                  setRunsPage(1);
                  setItemsPage(1);
                  setSelectedRunId('');
                }}
              >
                <option value='all'>{t('reportValidation.filters.all')}</option>
                <option value='pending'>{t('reportValidation.status.pending')}</option>
                <option value='running'>{t('reportValidation.status.running')}</option>
                <option value='completed'>{t('reportValidation.status.completed')}</option>
                <option value='failed'>{t('reportValidation.status.failed')}</option>
              </Select>
            </div>

            <div className='hidden xl:flex items-end justify-end'>
              {selectedRun ? (
                <div className='rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                  <span className='font-medium'>{t('reportValidation.detail.batchId')}:</span>{' '}
                  <span className='font-mono text-xs'>{selectedRun.sourceBatchId}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative overflow-hidden'>
          <div className='px-4 sm:px-6 mb-4'>
            <h5 className='card-title text-dark dark:text-white'>{t('reportValidation.runs.title')}</h5>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>{t('reportValidation.runs.description')}</p>
          </div>
          <SimpleBar className='min-h-0'>
            <div className='overflow-x-auto min-w-0'>
              <Table hoverable className='w-full text-left min-w-[760px]'>
                <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
                  <TableRow>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                      <button
                        type='button'
                        onClick={() => handleRunsSort('seq')}
                        className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                      >
                        <span>{t('reportValidation.columns.seq')}</span>
                        <span className={runsSortBy === 'seq' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}>
                          {sortIndicator(runsSortBy === 'seq', runsSortOrder)}
                        </span>
                      </button>
                    </TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.type')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.horizon')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                      <button
                        type='button'
                        onClick={() => handleRunsSort('status')}
                        className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                      >
                        <span>{t('reportValidation.columns.status')}</span>
                        <span
                          className={
                            runsSortBy === 'status' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                          }
                        >
                          {sortIndicator(runsSortBy === 'status', runsSortOrder)}
                        </span>
                      </button>
                    </TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.progress')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                      <button
                        type='button'
                        onClick={() => handleRunsSort('overallScore')}
                        className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                      >
                        <span>{t('reportValidation.columns.overallScore')}</span>
                        <span
                          className={
                            runsSortBy === 'overallScore'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }
                        >
                          {sortIndicator(runsSortBy === 'overallScore', runsSortOrder)}
                        </span>
                      </button>
                    </TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                      <button
                        type='button'
                        onClick={() => handleRunsSort('completedAt')}
                        className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                      >
                        <span>{t('reportValidation.columns.completedAt')}</span>
                        <span
                          className={
                            runsSortBy === 'completedAt'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }
                        >
                          {sortIndicator(runsSortBy === 'completedAt', runsSortOrder)}
                        </span>
                      </button>
                    </TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {isRunsLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
                        {t('loading')}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isRunsLoading && runs.length < 1 && (
                    <TableRow>
                      <TableCell colSpan={7} className='px-4 py-8'>
                        <div className='flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 text-sm'>
                          <Icon icon='solar:document-text-line-duotone' width={22} height={22} />
                          <span>{t('reportValidation.emptyRuns')}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {runs.map((run) => {
                    const active = run.id === activeRunId;
                    return (
                      <TableRow
                        key={run.id}
                        onClick={() => {
                          setSelectedRunId(run.id);
                          setItemsPage(1);
                        }}
                        className={`cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          active ? 'bg-lightprimary/40 dark:bg-darkprimary/30' : ''
                        }`}
                      >
                        <TableCell className='px-4 py-3 whitespace-nowrap font-medium text-dark dark:text-white'>
                          {run.seq}
                        </TableCell>
                        <TableCell className='px-4 py-3 whitespace-nowrap'>{t(`reportValidation.type.${run.reportType}`)}</TableCell>
                        <TableCell className='px-4 py-3 whitespace-nowrap'>{`${run.horizonHours}h`}</TableCell>
                        <TableCell className='px-4 py-3 whitespace-nowrap'>
                          <Badge color={toBadgeColor(run.status, null)}>{statusLabel(t, run.status)}</Badge>
                        </TableCell>
                        <TableCell className='px-4 py-3 whitespace-nowrap'>{`${run.completedCount}/${run.itemCount}`}</TableCell>
                        <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(run.overallScore)}`}>
                          {formatScore(run.overallScore)}
                        </TableCell>
                        <TableCell className='px-4 py-3 whitespace-nowrap'>
                          {run.completedAt ? formatDate(new Date(run.completedAt)) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SimpleBar>
          {!isRunsLoading && runsData && (
            <div className='mt-4 flex flex-col gap-3 px-4 pb-6 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-sm text-gray-700 dark:text-gray-300'>
                {t('pagination', {
                  start: (runsData.page - 1) * (runsData.perPage ?? 1) + 1,
                  end: Math.min(runsData.page * (runsData.perPage ?? 1), runsData.total),
                  total: runsData.total,
                })}
              </div>
              <div className='w-full overflow-x-auto sm:w-auto'>
                <div className='flex w-max gap-2 sm:justify-end'>
                  {Array.from({ length: runsData.totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`px-3 py-1 text-sm rounded ${
                        runsData.page === pageNumber
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 dark:bg-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                      }`}
                      disabled={runsData.page === pageNumber}
                      onClick={() => {
                        setRunsPage(pageNumber);
                        setItemsPage(1);
                        setSelectedRunId('');
                      }}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative overflow-hidden'>
          <div className='px-4 sm:px-6 mb-4'>
            <h5 className='card-title text-dark dark:text-white'>{t('reportValidation.detail.title')}</h5>
            {selectedRun ? (
              <div className='mt-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge color='info'>{t(`reportValidation.type.${selectedRun.reportType}`)}</Badge>
                  <Badge color='gray'>{`${selectedRun.horizonHours}h`}</Badge>
                  <Badge color={toBadgeColor(selectedRun.status, null)}>{statusLabel(t, selectedRun.status)}</Badge>
                </div>

                <div className='mt-3 grid grid-cols-1 gap-3'>
                  <div className='rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.summary')}</p>
                    <p className='mt-1 text-sm text-gray-700 dark:text-gray-300 break-words'>
                      {selectedRun.summary && selectedRun.summary.length > 0 ? selectedRun.summary : '-'}
                    </p>
                  </div>
                  <div className='grid grid-cols-12 gap-3'>
                    <div className='col-span-12 md:col-span-3 xl:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.itemCount')}</p>
                      <p className='mt-1 text-xl font-semibold text-gray-900 dark:text-white'>{itemStats.itemCount}</p>
                    </div>
                    <div className='col-span-12 md:col-span-3 xl:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.invalidCount')}</p>
                      <p className='mt-1 text-xl font-semibold text-gray-900 dark:text-white'>{itemStats.invalidCount}</p>
                    </div>
                    <div className='col-span-12 md:col-span-3 xl:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.avgReturn')}</p>
                      <p className={`mt-1 text-xl font-semibold ${returnClassName(itemStats.avgReturn)}`}>
                        {formatSignedPercent(itemStats.avgReturn)}
                      </p>
                    </div>
                    <div className='col-span-12 md:col-span-3 xl:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.avgItemScore')}</p>
                      <p className={`mt-1 text-xl font-semibold ${scoreClassName(itemStats.avgItemScore)}`}>
                        {formatScore(itemStats.avgItemScore)}
                      </p>
                    </div>
                    <div className='col-span-12 xl:col-span-4 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.verdictBreakdown')}</p>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        <Badge color='success'>{`${t('reportValidation.verdict.good')} ${itemStats.verdictGood}`}</Badge>
                        <Badge color='warning'>{`${t('reportValidation.verdict.mixed')} ${itemStats.verdictMixed}`}</Badge>
                        <Badge color='failure'>{`${t('reportValidation.verdict.bad')} ${itemStats.verdictBad}`}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedRun.error && (
                  <p className='mt-3 text-sm text-red-500'>
                    <span className='font-medium'>{t('reportValidation.detail.error')}:</span> {selectedRun.error}
                  </p>
                )}
              </div>
            ) : (
              <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('reportValidation.detail.emptyDescription')}</p>
            )}
          </div>

          <div className='mt-5'>
            <SimpleBar className='min-h-0'>
              <div className='overflow-x-auto min-w-0'>
                <Table hoverable className='w-full text-left min-w-[1220px]'>
                  <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
                    <TableRow>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('symbol')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.symbol')}</span>
                          <span
                            className={
                              itemsSortBy === 'symbol' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'symbol', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('status')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.status')}</span>
                          <span
                            className={
                              itemsSortBy === 'status' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'status', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('aiVerdict')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.verdict')}</span>
                          <span
                            className={
                              itemsSortBy === 'aiVerdict'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'aiVerdict', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('deterministicScore')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.deterministicScore')}</span>
                          <span
                            className={
                              itemsSortBy === 'deterministicScore'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'deterministicScore', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('aiScore')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.aiScore')}</span>
                          <span
                            className={
                              itemsSortBy === 'aiScore' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'aiScore', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.overallScore')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('returnPct')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.returnPct')}</span>
                          <span
                            className={
                              itemsSortBy === 'returnPct' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'returnPct', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.nextGuardrail')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => handleItemsSort('evaluatedAt')}
                          className='inline-flex w-full cursor-pointer select-none items-center gap-1 px-4 py-3 -mx-4 -my-3 text-left hover:text-blue-600 dark:hover:text-blue-400'
                        >
                          <span>{t('reportValidation.items.evaluatedAt')}</span>
                          <span
                            className={
                              itemsSortBy === 'evaluatedAt'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }
                          >
                            {sortIndicator(itemsSortBy === 'evaluatedAt', itemsSortOrder)}
                          </span>
                        </button>
                      </TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                    {isItemsLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
                          {t('loading')}
                        </TableCell>
                      </TableRow>
                    )}

                    {!isItemsLoading && items.length < 1 && (
                      <TableRow>
                        <TableCell colSpan={9} className='px-4 py-8'>
                          <div className='flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 text-sm'>
                            <Icon icon='solar:list-check-line-duotone' width={22} height={22} />
                            <span>{t('reportValidation.emptyItems')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {items.map((item) => {
                      const overallScore = calculateItemOverallScore(item);

                      return (
                        <TableRow
                          key={item.id}
                          className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        >
                          <TableCell className='px-4 py-3 whitespace-nowrap font-medium text-dark dark:text-white'>
                            {item.symbol}
                          </TableCell>
                          <TableCell className='px-4 py-3 whitespace-nowrap'>
                            <Badge color={toBadgeColor(item.status, item.aiVerdict)}>{statusLabel(t, item.status)}</Badge>
                          </TableCell>
                          <TableCell className='px-4 py-3 whitespace-nowrap'>{verdictLabel(t, item.aiVerdict)}</TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(item.deterministicScore)}`}>
                            {formatScore(item.deterministicScore)}
                          </TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(item.aiScore)}`}>
                            {formatScore(item.aiScore)}
                          </TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(overallScore)}`}>
                            {formatScore(overallScore)}
                          </TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${returnClassName(item.returnPct)}`}>
                            {formatSignedPercent(item.returnPct)}
                          </TableCell>
                          <TableCell className='px-4 py-3 text-sm max-w-[420px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
                            {item.nextGuardrail ?? '-'}
                            {item.error && <p className='text-red-500 mt-1'>{item.error}</p>}
                          </TableCell>
                          <TableCell className='px-4 py-3 whitespace-nowrap'>
                            {item.evaluatedAt ? formatDate(new Date(item.evaluatedAt)) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SimpleBar>
            {!isItemsLoading && itemsData && (
              <div className='mt-4 flex flex-col gap-3 px-4 pb-6 sm:flex-row sm:items-center sm:justify-between'>
                <div className='text-sm text-gray-700 dark:text-gray-300'>
                  {t('pagination', {
                    start: (itemsData.page - 1) * (itemsData.perPage ?? 1) + 1,
                    end: Math.min(itemsData.page * (itemsData.perPage ?? 1), itemsData.total),
                    total: itemsData.total,
                  })}
                </div>
                <div className='w-full overflow-x-auto sm:w-auto'>
                  <div className='flex w-max gap-2 sm:justify-end'>
                    {Array.from({ length: itemsData.totalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        className={`px-3 py-1 text-sm rounded ${
                          itemsData.page === pageNumber
                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 dark:bg-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                        }`}
                        disabled={itemsData.page === pageNumber}
                        onClick={() => setItemsPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default Page;
