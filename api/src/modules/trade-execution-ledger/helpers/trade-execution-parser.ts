import {
  AllocationMode,
  QueueTradeExecutionMessageV2,
  TradeExecutionMessageV2,
} from '@/modules/allocation-core/allocation-core.types';
import { TradeExecutionModule } from '@/modules/trade-execution-ledger/trade-execution-ledger.enum';

import { isNonEmptyString, isValidDateString } from './sqs-message';

interface ParseTradeExecutionMessageOptions {
  module: TradeExecutionModule;
  moduleLabel: 'allocation' | 'risk';
  queueMessageVersion: TradeExecutionMessageV2['version'];
  messageBody: string | undefined;
  acceptedModuleAliases?: string[];
  parseInference(inference: unknown): TradeExecutionMessageV2['inferences'][number];
  parseAllocationMode?: (value: unknown) => AllocationMode;
}

export function parseTradeExecutionMessage(options: ParseTradeExecutionMessageOptions): TradeExecutionMessageV2 {
  if (!options.messageBody) {
    throw new Error('Empty SQS message body');
  }

  const parsed = JSON.parse(options.messageBody) as Partial<QueueTradeExecutionMessageV2> & Record<string, unknown>;

  if (parsed.version !== options.queueMessageVersion) {
    throw new Error(`Unsupported ${options.moduleLabel} message version`);
  }

  return parseTradeExecutionMessageV2(parsed, options);
}

function parseTradeExecutionMessageV2(
  parsed: Partial<QueueTradeExecutionMessageV2>,
  options: ParseTradeExecutionMessageOptions,
): TradeExecutionMessageV2 {
  if (!isSupportedModuleLabel(parsed.module, options.module, options.acceptedModuleAliases)) {
    throw new Error(`Unsupported ${options.moduleLabel} message module`);
  }
  if (!isNonEmptyString(parsed.runId)) {
    throw new Error('Invalid runId');
  }
  if (!isNonEmptyString(parsed.messageKey)) {
    throw new Error('Invalid messageKey');
  }
  if (!isNonEmptyString(parsed.userId)) {
    throw new Error('Invalid userId');
  }
  if (!isValidDateString(parsed.generatedAt)) {
    throw new Error('Invalid generatedAt');
  }
  if (!isValidDateString(parsed.expiresAt)) {
    throw new Error('Invalid expiresAt');
  }
  if (!Array.isArray(parsed.inferences)) {
    throw new Error('Invalid inferences');
  }

  const message: TradeExecutionMessageV2 = {
    version: options.queueMessageVersion,
    module: options.module,
    runId: parsed.runId,
    messageKey: parsed.messageKey,
    userId: parsed.userId,
    generatedAt: parsed.generatedAt,
    expiresAt: parsed.expiresAt,
    inferences: parsed.inferences.map((inference) => options.parseInference(inference)),
  };

  if (options.parseAllocationMode) {
    const legacyMode = (parsed as Record<string, unknown>).portfolioMode;
    message.allocationMode = options.parseAllocationMode(parsed.allocationMode ?? legacyMode);
  }

  return message;
}

function isSupportedModuleLabel(value: unknown, module: TradeExecutionModule, aliases: string[] = []): boolean {
  return typeof value === 'string' && (value === module || aliases.includes(value));
}
