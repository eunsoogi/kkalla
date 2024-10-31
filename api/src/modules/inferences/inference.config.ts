export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_MAX_TOKENS = 1024;

export const INFERENCE_MESSAGE_CONFIG = {
  candles: {
    m15: 96,
    h1: 24 * 7,
    h4: 6 * 30,
    d1: 90,
  },
  newsLimit: 100,
  inferenceLimit: 6 * 7,
};

export const INFERENCE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decision: {
      type: 'string',
    },
    rate: {
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
  required: ['decision', 'rate', 'reason', 'reflection'],
};

export const INFERENCE_RULES = [
  '답변은 반드시 JSON format으로만 할 것',
  '한국어로 답변할 것',
  'decision은 반드시 "buy", "sell", "hold" 중 하나여야 함',
  'decision은 reflection을 복기할 것',
  'rate는 얼마만큼 분할 매수 및 분할 매도할 지 0~1 사이로 비율을 결정할 것',
  'decision이 "hold"일 경우, rate는 0으로 판단할 것',
  '반드시 분할 매수 및 분할 매도할 것',
  'reason은 제공된 데이터 각각에 대한 판단을 서술할 것',
  'reflection은 prevInferences를 복기한 내용을 서술할 것',
];

export const INFERENCE_TECH_INDICATOR = ['MACD(12, 26, 9)', 'RSI(14)', '볼린저밴드(20, 2)', '일목균형표', 'OBV'];

export const INFERENCE_PROMPT = [
  '당신은 코인 투자 전문가입니다.',
  '규칙:',
  ...INFERENCE_RULES.map((item, index) => `${index + 1}. ${item}`),
  '기술적 지표:',
  ...INFERENCE_TECH_INDICATOR.map((item, index) => `${index + 1}. ${item}`),
];
