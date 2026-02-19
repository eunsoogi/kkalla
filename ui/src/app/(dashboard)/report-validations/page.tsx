'use client';

import React, { useMemo, useState } from 'react';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useQuery } from '@tanstack/react-query';
import { Badge, Label, Select, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ForbiddenError } from '@/components/error/403';
import { getReportValidationRunItemsAction, getReportValidationRunsAction } from '@/components/report-validation/action';
import { Permission } from '@/interfaces/permission.interface';
import {
  ReportType,
  ReportValidationItem,
  ReportValidationRun,
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
  if (typeof item.deterministicScore === 'number' && typeof item.gptScore === 'number') {
    return 0.6 * item.deterministicScore + 0.4 * item.gptScore;
  }

  if (typeof item.deterministicScore === 'number') {
    return item.deterministicScore;
  }

  if (typeof item.gptScore === 'number') {
    return item.gptScore;
  }

  return null;
};

const Page: React.FC = () => {
  const t = useTranslations();
  const [reportType, setReportType] = useState<'all' | ReportType>('all');
  const [status, setStatus] = useState<'all' | ReportValidationStatus>('all');
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const { data: runs = [], isLoading: isRunsLoading } = useQuery<ReportValidationRun[]>({
    queryKey: ['report-validation', 'runs', reportType, status],
    queryFn: () =>
      getReportValidationRunsAction({
        reportType,
        status,
        limit: 80,
      }),
  });

  const activeRunId = useMemo(() => {
    if (runs.length < 1) {
      return '';
    }

    const exists = runs.some((run) => run.id === selectedRunId);
    return exists ? selectedRunId : runs[0].id;
  }, [runs, selectedRunId]);

  const selectedRun = useMemo(() => runs.find((run) => run.id === activeRunId), [runs, activeRunId]);

  const { data: items = [], isLoading: isItemsLoading } = useQuery<ReportValidationItem[]>({
    queryKey: ['report-validation', 'run-items', activeRunId],
    queryFn: () => getReportValidationRunItemsAction(activeRunId, 300),
    enabled: !!activeRunId,
  });

  const summaryStats = useMemo(() => {
    const pendingOrRunning = runs.filter((run) => run.status === 'pending' || run.status === 'running').length;
    const completed = runs.filter((run) => run.status === 'completed').length;
    const scores = runs
      .map((run) => run.overallScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

    return {
      totalRuns: runs.length,
      pendingOrRunning,
      completed,
      avgScore,
    };
  }, [runs]);

  const itemStats = useMemo(() => {
    const validItems = items.filter((item) => item.gptVerdict !== 'invalid');
    const invalidCount = items.filter((item) => item.gptVerdict === 'invalid').length;

    const scores = validItems
      .map((item) => calculateItemOverallScore(item))
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const avgItemScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

    const returns = validItems
      .map((item) => item.returnPct)
      .filter((ret): ret is number => typeof ret === 'number' && Number.isFinite(ret));
    const avgReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : null;

    const verdictGood = validItems.filter((item) => item.gptVerdict === 'good').length;
    const verdictMixed = validItems.filter((item) => item.gptVerdict === 'mixed').length;
    const verdictBad = validItems.filter((item) => item.gptVerdict === 'bad').length;

    return {
      itemCount: items.length,
      invalidCount,
      avgItemScore,
      avgReturn,
      verdictGood,
      verdictMixed,
      verdictBad,
    };
  }, [items]);

  return (
    <PermissionGuard permissions={[Permission.EXEC_SCHEDULE_REPORT_VALIDATION]} fallback={<ForbiddenError />}>
      <div className='space-y-6'>
        <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>{t('reportValidation.title')}</h1>
          <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>{t('reportValidation.description')}</p>

          <div className='mt-5 grid grid-cols-12 gap-3'>
            <div className='col-span-12 md:col-span-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.stats.totalRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-gray-900 dark:text-white'>{summaryStats.totalRuns}</p>
            </div>
            <div className='col-span-12 md:col-span-3 rounded-lg border border-amber-300/50 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-500/40 px-4 py-3'>
              <p className='text-xs text-amber-700 dark:text-amber-300'>{t('reportValidation.stats.activeRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-amber-800 dark:text-amber-200'>
                {summaryStats.pendingOrRunning}
              </p>
            </div>
            <div className='col-span-12 md:col-span-3 rounded-lg border border-green-300/50 bg-green-50/40 dark:bg-green-900/10 dark:border-green-500/40 px-4 py-3'>
              <p className='text-xs text-green-700 dark:text-green-300'>{t('reportValidation.stats.completedRuns')}</p>
              <p className='mt-1 text-xl font-semibold text-green-800 dark:text-green-200'>{summaryStats.completed}</p>
            </div>
            <div className='col-span-12 md:col-span-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>{t('reportValidation.stats.avgScore')}</p>
              <p className={`mt-1 text-xl font-semibold ${scoreClassName(summaryStats.avgScore)}`}>
                {formatScore(summaryStats.avgScore)}
              </p>
            </div>
          </div>

          <div className='mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[260px_260px_1fr]'>
            <div className='min-w-0'>
              <Label htmlFor='reportType'>{t('reportValidation.filters.reportType')}</Label>
              <Select
                id='reportType'
                value={reportType}
                onChange={(event) => setReportType(event.target.value as 'all' | ReportType)}
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
                onChange={(event) => setStatus(event.target.value as 'all' | ReportValidationStatus)}
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
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.seq')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.type')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.horizon')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.status')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.progress')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.overallScore')}</TableHeadCell>
                    <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.columns.completedAt')}</TableHeadCell>
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
                        onClick={() => setSelectedRunId(run.id)}
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
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.symbol')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.status')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.verdict')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.deterministicScore')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.aiScore')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.overallScore')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.returnPct')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.nextGuardrail')}</TableHeadCell>
                      <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('reportValidation.items.evaluatedAt')}</TableHeadCell>
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
                            <Badge color={toBadgeColor(item.status, item.gptVerdict)}>{statusLabel(t, item.status)}</Badge>
                          </TableCell>
                          <TableCell className='px-4 py-3 whitespace-nowrap'>{verdictLabel(t, item.gptVerdict)}</TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(item.deterministicScore)}`}>
                            {formatScore(item.deterministicScore)}
                          </TableCell>
                          <TableCell className={`px-4 py-3 whitespace-nowrap font-medium ${scoreClassName(item.gptScore)}`}>
                            {formatScore(item.gptScore)}
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
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default Page;
