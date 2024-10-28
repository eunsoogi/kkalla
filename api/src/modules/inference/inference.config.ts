export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_MAX_TOKENS = 512;

export const INFERENCE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decision: {
      type: 'string',
    },
    suggestedBalance: {
      type: 'number',
    },
    reason: {
      type: 'string',
    },
    reflection: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['decision', 'suggestedBalance', 'reason', 'reflection'],
};

export const INFERENCE_RULES = [
  '답변은 반드시 JSON format으로만 할 것',
  'decision은 반드시 "buy", "sell", "hold" 중 하나여야 함',
  'decision은 reflection을 고려하여 결정할 것',
  'suggestedBalance는 현재 가지고 있는 krwBalance 또는 btcBalance 중에 얼마만큼 매수하거나 매도할 지 판단할 것',
  '반드시 분할 매수 및 분할 매도할 것',
  'reason에는 한국어로 작성하고, 제공된 데이터 각각에 대한 판단을 포함할 것',
  'reflection에는 이전 inference가 적절했는지 여부를 판단할 것',
];

export const INFERENCE_TECH_INDICATOR = ['MACD(12, 26, 9)', 'RSI(14)', '볼린저밴드(20, 2)', '일목균형표', 'OBV'];

export const INFERENCE_PROMPT = [
  '당신은 코인 투자 전문가입니다.',
  '규칙:',
  ...INFERENCE_RULES.map((item, index) => `${index + 1}. ${item}`),
  '기술적 지표:',
  ...INFERENCE_TECH_INDICATOR.map((item, index) => `${index + 1}. ${item}`),
];
