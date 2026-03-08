import { formatNumber, formatPercent } from '@/utils/number';
import { resolveGateBypassedReasonLabel, resolveTriggerReasonLabel } from '@/utils/trade-label';

import type { Trade, TradeExplanation, TradeFieldAbsence } from './trade.types';

type TranslateFn = (key: string, values?: Record<string, any>) => string;

const translateAbsence = (t: TranslateFn, state: TradeFieldAbsence): string => t(`trade.absence.${state}`);

const formatNullableNumber = (
  t: TranslateFn,
  value: number | null | undefined,
  formatter: (value?: number | null) => string,
  absence: TradeFieldAbsence = 'not_captured',
): string => {
  if (value == null || !Number.isFinite(value)) {
    return translateAbsence(t, absence);
  }

  return formatter(value);
};

const resolvePlainWhy = (t: TranslateFn, trade: Trade): string => {
  const reduced =
    trade.decisionRequestedTradeNotional != null &&
    trade.decisionCappedTradeNotional != null &&
    trade.decisionRequestedTradeNotional > trade.decisionCappedTradeNotional + Number.EPSILON;

  if (trade.decisionRegimeSource === 'unavailable_risk_off') {
    return t('trade.explanation.why.conservativeMode');
  }

  if (reduced) {
    return t('trade.explanation.why.reducedSize');
  }

  if (trade.gateBypassedReason === 'urgent_risk_reduction') {
    return t('trade.explanation.why.urgentSell');
  }

  switch (trade.triggerReason) {
    case 'included_rebalance':
      return t('trade.explanation.why.rebalance');
    case 'excluded_staged_exit':
    case 'no_trade_trim':
      return t('trade.explanation.why.trimPosition');
    case 'missing_from_inference':
    case 'missing_inference_grace_elapsed':
      return t('trade.explanation.why.removeOutOfScope');
    case 'profit-take':
    case 'trailing_take_profit':
      return t('trade.explanation.why.takeProfit');
    default:
      return t('trade.explanation.why.generic');
  }
};

const resolvePlainSummary = (t: TranslateFn, trade: Trade): string => {
  const reduced =
    trade.decisionRequestedTradeNotional != null &&
    trade.decisionCappedTradeNotional != null &&
    trade.decisionRequestedTradeNotional > trade.decisionCappedTradeNotional + Number.EPSILON;

  return t(reduced ? 'trade.explanation.whatHappened.reduced' : 'trade.explanation.whatHappened.executed', {
    amount: formatNumber(trade.amount),
  });
};

const resolveTriageCue = (t: TranslateFn, trade: Trade): string | null => {
  const reduced =
    trade.decisionRequestedTradeNotional != null &&
    trade.decisionCappedTradeNotional != null &&
    trade.decisionRequestedTradeNotional > trade.decisionCappedTradeNotional + Number.EPSILON;

  if (trade.decisionRegimeSource === 'unavailable_risk_off') {
    return t('trade.triage.conservativeMode');
  }

  if (reduced) {
    return t('trade.triage.reducedExecution');
  }

  if (trade.gateBypassedReason === 'urgent_risk_reduction') {
    return t('trade.triage.urgentExecution');
  }

  return null;
};

const resolvePositionClass = (t: TranslateFn, value?: Trade['decisionPositionClass'] | null): string => {
  if (value === 'existing') {
    return t('trade.positionClass.existing');
  }
  if (value === 'new') {
    return t('trade.positionClass.new');
  }
  return translateAbsence(t, 'not_captured');
};

const resolveRegimeSource = (t: TranslateFn, value?: Trade['decisionRegimeSource'] | null): string => {
  if (value === 'live') {
    return t('trade.regimeSource.live');
  }
  if (value === 'cache_fallback') {
    return t('trade.regimeSource.cacheFallback');
  }
  if (value === 'unavailable_risk_off') {
    return t('trade.regimeSource.unavailableRiskOff');
  }
  return translateAbsence(t, 'not_captured');
};

const resolveUrgency = (t: TranslateFn, value?: Trade['decisionExecutionUrgency'] | null): string => {
  if (value === 'urgent') {
    return t('trade.executionUrgency.urgent');
  }
  if (value === 'normal') {
    return t('trade.executionUrgency.normal');
  }
  return translateAbsence(t, 'not_captured');
};

const resolveCalibrationCoefficient = (t: TranslateFn, trade: Trade): string => {
  if (trade.type === 'sell') {
    return translateAbsence(t, 'not_applicable');
  }
  if (trade.costCalibrationCoefficient == null || !Number.isFinite(trade.costCalibrationCoefficient)) {
    return translateAbsence(t, 'not_captured');
  }
  return `${trade.costCalibrationCoefficient.toFixed(2)}x`;
};

export const buildTradeExplanation = (trade: Trade, t: TranslateFn): TradeExplanation => {
  const summary = resolvePlainSummary(t, trade);
  const why = resolvePlainWhy(t, trade);
  const triageCue = resolveTriageCue(t, trade);

  return {
    summary,
    why,
    triageCue,
    decisionSummaryRows: [
      {
        key: 'summary',
        label: t('trade.detail.summary'),
        value: summary,
      },
      {
        key: 'why',
        label: t('trade.detail.why'),
        value: why,
      },
      {
        key: 'trigger',
        label: t('trade.triggerReason'),
        value: resolveTriggerReasonLabel(t, trade.triggerReason),
      },
      {
        key: 'gateBypass',
        label: t('trade.gateBypassedReason'),
        value: resolveGateBypassedReasonLabel(t, trade.gateBypassedReason),
      },
    ],
    executionLimitRows: [
      {
        key: 'requestedTradeNotional',
        label: t('trade.detail.requestedTradeNotional'),
        value: formatNullableNumber(t, trade.decisionRequestedTradeNotional, (value) => formatNumber(value ?? 0)),
      },
      {
        key: 'cappedTradeNotional',
        label: t('trade.detail.cappedTradeNotional'),
        value: formatNullableNumber(t, trade.decisionCappedTradeNotional, (value) => formatNumber(value ?? 0)),
      },
      {
        key: 'positionClass',
        label: t('trade.detail.positionClass'),
        value: resolvePositionClass(t, trade.decisionPositionClass),
      },
      {
        key: 'executionUrgency',
        label: t('trade.detail.executionUrgency'),
        value: resolveUrgency(t, trade.decisionExecutionUrgency),
      },
    ],
    costReviewRows: [
      {
        key: 'expectedEdgeRate',
        label: `${t('trade.expectedEdgeRate')} · ${t('trade.time.decision')}`,
        value: formatNullableNumber(t, trade.expectedEdgeRate, (value) => formatPercent(value, 2)),
      },
      {
        key: 'estimatedCostRate',
        label: `${t('trade.estimatedCostRate')} · ${t('trade.time.decision')}`,
        value: formatNullableNumber(t, trade.estimatedCostRate, (value) => formatPercent(value, 2)),
      },
      {
        key: 'realizedCostRate',
        label: `${t('trade.detail.realizedCostRate')} · ${t('trade.time.execution')}`,
        value: formatNullableNumber(t, trade.realizedCostRate, (value) => formatPercent(value, 2)),
      },
      {
        key: 'costCalibrationCoefficient',
        label: `${t('trade.detail.costCalibrationCoefficient')} · ${t('trade.time.execution')}`,
        value: resolveCalibrationCoefficient(t, trade),
      },
    ],
    modeFallbackRows: [
      {
        key: 'regimeSource',
        label: t('trade.detail.regimeSource'),
        value: resolveRegimeSource(t, trade.decisionRegimeSource),
      },
      {
        key: 'explanationMode',
        label: t('trade.detail.modeState'),
        value:
          trade.decisionRegimeSource === 'unavailable_risk_off'
            ? t('trade.explanation.mode.conservative')
            : t('trade.explanation.mode.standard'),
      },
      {
        key: 'fallbackState',
        label: t('trade.detail.fallbackState'),
        value:
          trade.gateBypassedReason != null
            ? t('trade.explanation.fallback.gateBypassed')
            : translateAbsence(t, 'not_applicable'),
      },
    ],
  };
};
