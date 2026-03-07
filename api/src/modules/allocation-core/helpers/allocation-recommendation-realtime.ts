import type { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import { Category } from '@/modules/category/category.enum';
import { normalizeKrwSymbol } from '@/utils/symbol';

import type {
  RealtimeRecommendationResultContext,
  RecommendationBuilderConfig,
  RecommendationInferenceLogger,
  RecommendationInferenceTranslator,
  RecommendationRealtimeFlowOptions,
  RecommendationRealtimeInferenceHandlers,
  RecommendationRealtimeSharedBuilderFlowOptions,
  RecommendationResultDraft,
} from './allocation-recommendation-realtime.types';

function groupItemsByTargetSymbol<TItem extends { targetSymbol: string }>(items: TItem[]): Map<string, TItem[]> {
  const itemsByTargetSymbol = new Map<string, TItem[]>();

  for (const item of items) {
    const existingItems = itemsByTargetSymbol.get(item.targetSymbol);
    if (existingItems) {
      existingItems.push(item);
      continue;
    }

    itemsByTargetSymbol.set(item.targetSymbol, [item]);
  }

  return itemsByTargetSymbol;
}

export function buildRecommendationRealtimeInferenceHandlers(options: {
  logger: RecommendationInferenceLogger;
  i18n: RecommendationInferenceTranslator;
  responseLabel: string;
}): RecommendationRealtimeInferenceHandlers {
  return {
    onNewsError: (error) => options.logger.error(options.i18n.t('logging.news.load_failed'), error),
    onMarketRegimeError: (error) => options.logger.error(options.i18n.t('logging.marketRegime.load_failed'), error),
    onValidationGuardrailError: (error, symbol) => {
      options.logger.warn(
        options.i18n.t('logging.inference.allocationRecommendation.validation_guardrail_load_failed', {
          args: { symbol },
        }),
        error,
      );
    },
    onUnexpectedSymbol: ({ outputSymbol }) => {
      options.logger.warn(
        options.i18n.t('logging.inference.allocationRecommendation.response_unexpected_symbol', {
          args: { outputSymbol },
        }),
      );
    },
    onDuplicateSymbol: ({ outputSymbol }) => {
      options.logger.warn(
        options.i18n.t('logging.inference.allocationRecommendation.response_duplicate_symbol', {
          args: { outputSymbol },
        }),
      );
    },
    onInferenceFailed: (error) =>
      options.logger.warn(options.i18n.t('logging.inference.allocationRecommendation.realtime_failed'), error),
    buildIncompleteResponseError: ({ expectedCount, receivedCount }) =>
      `Incomplete ${options.responseLabel} multi-symbol response: expected ${expectedCount}, received ${receivedCount}`,
    buildMissingResponseError: ({ symbol }) => `Missing ${options.responseLabel} result for ${symbol}`,
  };
}

function createRealtimeRecommendationResultBuilder<TItem extends RecommendationItem>(
  options: RecommendationBuilderConfig<TItem>,
) {
  return (context: RealtimeRecommendationResultContext<TItem>): RecommendationResultDraft | null => {
    const { item, targetSymbol, responseData, normalizedResponse, marketFeatures, marketRegime, feargreed } = context;
    if (!normalizedResponse) {
      return null;
    }

    const safeIntensity = normalizedResponse.intensity;
    const reason = normalizedResponse.reason;
    const latestMetrics =
      options.latestMetricsBySymbol.get(targetSymbol) ?? options.latestMetricsBySymbol.get(item.symbol) ?? null;
    const currentHoldingWeight = item.hasStock ? options.clampToUnitInterval(item.weight ?? 0) : 0;
    const previousModelTargetWeight = latestMetrics?.modelTargetWeight ?? null;
    const inferenceActionBaselineWeight = options.resolveInferenceActionBaselineWeight({
      item,
      currentHoldingWeight,
      previousModelTargetWeight,
    });
    const modelSignals = options.calculateModelSignals(
      safeIntensity,
      item.category,
      marketFeatures,
      targetSymbol,
      inferenceActionBaselineWeight,
    );
    const decisionConfidence = normalizedResponse.confidence;
    const tradeCostTelemetry = options.deriveTradeCostTelemetry(
      marketFeatures,
      normalizedResponse.expectedVolatilityPct,
      decisionConfidence,
    );
    const modelTargetWeight = options.clampToUnitInterval(modelSignals.modelTargetWeight);
    const buyCandidateTargetWeight = Math.max(modelTargetWeight, options.clampToUnitInterval(safeIntensity));
    const inferenceModelTargetWeight = modelTargetWeight <= Number.EPSILON ? 0 : buyCandidateTargetWeight;
    const inferenceModelAction = options.resolveInferenceRecommendationAction(
      inferenceActionBaselineWeight,
      inferenceModelTargetWeight,
    );
    const neutralModelTargetWeight = options.resolveNeutralModelTargetWeight({
      item,
      previousModelTargetWeight,
      modelTargetWeight,
    });
    const action = options.resolveServerRecommendationAction({
      modelAction: inferenceModelAction,
      decisionConfidence,
      currentHoldingWeight: inferenceActionBaselineWeight,
      nextModelTargetWeight: inferenceModelTargetWeight,
      minRecommendWeight: options.minRecommendWeight,
    });
    const resolvedModelTargetWeight = action === 'hold' ? neutralModelTargetWeight : inferenceModelTargetWeight;

    return {
      ...(typeof responseData === 'object' && responseData != null ? responseData : {}),
      symbol: targetSymbol,
      intensity: safeIntensity,
      reason: reason.length > 0 ? reason : null,
      category: item.category,
      hasStock: item.hasStock,
      prevIntensity: latestMetrics?.intensity ?? null,
      prevModelTargetWeight: previousModelTargetWeight,
      weight: item.weight,
      confidence: item.confidence,
      decisionConfidence,
      expectedVolatilityPct: normalizedResponse.expectedVolatilityPct,
      riskFlags: normalizedResponse.riskFlags,
      btcDominance: marketRegime?.btcDominance ?? null,
      altcoinIndex: marketRegime?.altcoinIndex ?? null,
      marketRegimeAsOf: marketRegime?.asOf ?? null,
      marketRegimeSource: marketRegime?.source ?? null,
      marketRegimeIsStale: marketRegime?.isStale ?? null,
      feargreedIndex: feargreed?.index ?? null,
      feargreedClassification: feargreed?.classification ?? null,
      feargreedTimestamp:
        feargreed?.timestamp != null && Number.isFinite(feargreed.timestamp)
          ? new Date(feargreed.timestamp * 1000)
          : null,
      buyScore: modelSignals.buyScore,
      sellScore: modelSignals.sellScore,
      modelTargetWeight: resolvedModelTargetWeight,
      action,
      expectedEdgeRate: tradeCostTelemetry.expectedEdgeRate,
      estimatedCostRate: tradeCostTelemetry.estimatedCostRate,
      spreadRate: tradeCostTelemetry.spreadRate,
      impactRate: tradeCostTelemetry.impactRate,
    };
  };
}

function createSharedRecommendationResultBuilder<TItem extends RecommendationItem>(
  options: RecommendationRealtimeSharedBuilderFlowOptions<TItem> & {
    latestMetricsBySymbol: Map<
      string,
      import('@/modules/allocation-core/trade-orchestration.types').LatestRecommendationMetrics
    >;
  },
) {
  const minRecommendWeight =
    options.minRecommendWeight ?? options.tradeOrchestrationService.getMinimumRecommendWeight();

  return createRealtimeRecommendationResultBuilder<TItem>({
    latestMetricsBySymbol: options.latestMetricsBySymbol,
    clampToUnitInterval: (value) => options.tradeOrchestrationService.clampToUnitInterval(value),
    calculateModelSignals: options.calculateModelSignals,
    deriveTradeCostTelemetry: options.deriveTradeCostTelemetry,
    resolveInferenceActionBaselineWeight: options.resolveInferenceActionBaselineWeight,
    resolveNeutralModelTargetWeight: ({ item, previousModelTargetWeight, modelTargetWeight }) =>
      options.tradeOrchestrationService.resolveNeutralModelTargetWeight(
        previousModelTargetWeight,
        item.weight,
        modelTargetWeight,
        item.hasStock,
        minRecommendWeight,
      ),
    resolveInferenceRecommendationAction: (previousModelTargetWeight, currentModelTargetWeight) =>
      options.tradeOrchestrationService.resolveInferenceRecommendationAction(
        previousModelTargetWeight,
        currentModelTargetWeight,
      ),
    resolveServerRecommendationAction: ({
      modelAction,
      decisionConfidence,
      currentHoldingWeight,
      nextModelTargetWeight,
      minRecommendWeight: currentMinRecommendWeight,
    }) =>
      options.tradeOrchestrationService.resolveServerRecommendationAction({
        modelAction,
        decisionConfidence,
        currentHoldingWeight,
        nextModelTargetWeight,
        minRecommendWeight: currentMinRecommendWeight,
      }),
    minRecommendWeight,
  });
}

export function normalizeRecommendationTargetSymbol<TItem extends Pick<RecommendationItem, 'symbol' | 'category'>>(
  item: TItem,
): string {
  return item.category === Category.NASDAQ ? item.symbol : (normalizeKrwSymbol(item.symbol) ?? item.symbol);
}

async function inferAndPersistRealtimeRecommendation<TItem extends RecommendationItem>(
  options: RecommendationRealtimeFlowOptions<TItem>,
) {
  const normalizedItems = options.items.map((item) => {
    const targetSymbol = options.normalizeTargetSymbol(item);
    if (targetSymbol !== item.symbol) {
      if (options.onSymbolNormalized) {
        options.onSymbolNormalized({ item, targetSymbol });
      } else {
        options.logger.warn(
          options.i18n.t('logging.inference.allocationRecommendation.symbol_normalized', {
            args: {
              from: item.symbol,
              to: targetSymbol,
            },
          }),
        );
      }
    }

    return { item, targetSymbol };
  });
  const latestRecommendationMetricsBySymbol =
    await options.tradeOrchestrationService.buildLatestRecommendationMetricsMap({
      recommendationItems: normalizedItems.map(({ item, targetSymbol }) => ({ ...item, symbol: targetSymbol })),
      errorService: options.errorService,
      onError: options.onLatestMetricsError,
    });
  const buildResult = options.createResultBuilder(latestRecommendationMetricsBySymbol);

  const itemsByTargetSymbol = groupItemsByTargetSymbol(normalizedItems);
  const realtimeInferenceHandlers = buildRecommendationRealtimeInferenceHandlers({
    logger: options.logger,
    i18n: options.i18n,
    responseLabel: options.responseLabel,
  });

  const inferenceResults = await options.tradeOrchestrationService.inferRecommendationsInRealtime({
    itemsByTargetSymbol,
    prompt: options.prompt,
    createRequestConfig: options.createRequestConfig,
    openaiService: options.openaiService,
    featureService: options.featureService,
    newsService: options.newsService,
    marketRegimeService: options.marketRegimeService,
    errorService: options.errorService,
    allocationAuditService: options.allocationAuditService,
    ...realtimeInferenceHandlers,
    buildResult: ({ item, targetSymbol, responseData, normalizedResponse, marketFeatures, marketRegime, feargreed }) =>
      buildResult({
        item: item.item,
        targetSymbol,
        responseData,
        normalizedResponse,
        marketFeatures,
        marketRegime,
        feargreed,
      }),
  });

  const validResults = inferenceResults.filter((result): result is NonNullable<typeof result> => result != null);
  if (validResults.length === 0) {
    return [];
  }

  options.onBeforePersist?.(validResults.length);

  return options.tradeOrchestrationService.persistAllocationRecommendationBatch({
    recommendations: validResults,
    enqueueAllocationBatchValidation: options.enqueueAllocationBatchValidation,
    onEnqueueValidationError: options.onEnqueueValidationError,
  });
}

export async function inferAndPersistSharedRealtimeRecommendation<TItem extends RecommendationItem>(
  options: RecommendationRealtimeSharedBuilderFlowOptions<TItem>,
) {
  return inferAndPersistRealtimeRecommendation({
    ...options,
    createResultBuilder: (latestMetricsBySymbol) =>
      createSharedRecommendationResultBuilder({
        ...options,
        latestMetricsBySymbol,
      }),
  });
}
