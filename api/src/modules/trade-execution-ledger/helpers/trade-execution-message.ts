import { AllocationRecommendationData } from '@/modules/allocation-core/allocation-core.types';
import { normalizeAllocationRecommendationAction } from '@/modules/allocation-core/helpers/allocation-recommendation';
import { Category } from '@/modules/category/category.enum';

import { isNonEmptyString } from './sqs-message';

/**
 * Parses queued inference for the trade execution ledger flow.
 * @param inference - Input value for inference.
 * @returns Result produced by the trade execution ledger flow.
 */
export function parseQueuedInference(inference: unknown): AllocationRecommendationData {
  if (!inference || typeof inference !== 'object') {
    throw new Error('Invalid inference item');
  }

  const candidate = inference as Partial<AllocationRecommendationData>;
  const category = candidate.category as Category;
  // Category must be strict enum to keep downstream allocation routing deterministic.
  if (!Object.values(Category).includes(category)) {
    throw new Error('Invalid inference category');
  }

  if (!isNonEmptyString(candidate.id) || !isNonEmptyString(candidate.batchId)) {
    throw new Error('Invalid inference identity');
  }
  if (!isNonEmptyString(candidate.symbol)) {
    throw new Error('Invalid inference symbol');
  }

  // Normalize numeric fields to safe defaults so malformed producer payloads do not crash execution.
  return {
    id: candidate.id,
    batchId: candidate.batchId,
    symbol: candidate.symbol,
    category,
    intensity: Number.isFinite(candidate.intensity) ? Number(candidate.intensity) : 0,
    reason: typeof candidate.reason === 'string' ? candidate.reason : null,
    prevIntensity: Number.isFinite(candidate.prevIntensity) ? Number(candidate.prevIntensity) : null,
    prevModelTargetWeight: Number.isFinite(candidate.prevModelTargetWeight)
      ? Number(candidate.prevModelTargetWeight)
      : null,
    buyScore: Number.isFinite(candidate.buyScore) ? Number(candidate.buyScore) : undefined,
    sellScore: Number.isFinite(candidate.sellScore) ? Number(candidate.sellScore) : undefined,
    modelTargetWeight: Number.isFinite(candidate.modelTargetWeight) ? Number(candidate.modelTargetWeight) : undefined,
    action: normalizeAllocationRecommendationAction(candidate.action),
    hasStock: Boolean(candidate.hasStock),
    weight: Number.isFinite(candidate.weight) ? Number(candidate.weight) : undefined,
    confidence: Number.isFinite(candidate.confidence) ? Number(candidate.confidence) : undefined,
    decisionConfidence: Number.isFinite(candidate.decisionConfidence)
      ? Number(candidate.decisionConfidence)
      : undefined,
    expectedVolatilityPct: Number.isFinite(candidate.expectedVolatilityPct)
      ? Number(candidate.expectedVolatilityPct)
      : undefined,
    riskFlags: Array.isArray(candidate.riskFlags)
      ? candidate.riskFlags.filter((item): item is string => typeof item === 'string')
      : [],
  };
}
