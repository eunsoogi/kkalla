import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const PROMPT_INPUT_TARGET_SYMBOLS = loadPromptMarkdown(__dirname, 'target-symbols.prompt.md').trim();
export const PROMPT_INPUT_NEWS = loadPromptMarkdown(__dirname, 'news.prompt.md').trim();
export const PROMPT_INPUT_MARKET_REGIME = loadPromptMarkdown(__dirname, 'market-regime.prompt.md').trim();
export const PROMPT_INPUT_FEARGREED = loadPromptMarkdown(__dirname, 'feargreed.prompt.md').trim();
export const PROMPT_INPUT_VALIDATION_ALLOCATION = loadPromptMarkdown(
  __dirname,
  'validation-allocation.prompt.md',
).trim();
export const PROMPT_INPUT_VALIDATION_MARKET = loadPromptMarkdown(__dirname, 'validation-market.prompt.md').trim();
