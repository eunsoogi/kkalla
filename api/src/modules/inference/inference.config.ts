export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_MAX_TOKENS = 2048;

export const INFERENCE_MESSAGE_CONFIG = {
  candles: {
    m15: 96,
    h1: 24 * 7,
    h4: 6 * 30,
    d1: 90,
  },
  newsLimit: 5000,
  inferenceLimit: 6 * 7,
};

export const INFERENCE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
          },
          decision: {
            type: 'string',
          },
          rate: {
            type: 'number',
          },
          cashMoreThan: {
            type: 'number',
          },
          cashLessThan: {
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
        required: ['symbol', 'decision', 'rate', 'cashMoreThan', 'cashLessThan', 'reason', 'reflection'],
      },
    },
  },
  additionalProperties: false,
  required: ['items'],
};

export const INFERENCE_RULES = [
  '답변은 반드시 JSON format으로만 할 것',
  '한국어로 답변할 것',
  'decision은 반드시 "buy", "sell", "hold" 중 하나여야 함',
  'decision은 캔들 차트, 뉴스, 공포탐욕지수, 기술적 지표를 분석하여 판단할 것',
  '현금 보유 비중이 0~0.2인 경우, 0.2~0.4인 경우, 0.4~0.6인 경우, 0.6~0.8인 경우, 0.8~1인 경우로 나눠 5번 판단할 것',
  'cashMoreThan는 현금 보유 비중이 몇 이상일 때인지 0~1 사이로 답변할 것',
  'cashLessThan는 현금 보유 비중이 몇 미만일 때인지 0~1 사이로 답변할 것',
  'rate는 얼마만큼 분할 매수 및 분할 매도할 지 0~1 사이로 비율을 결정할 것',
  'decision이 "hold"일 경우, rate는 0으로 판단할 것',
  '반드시 분할 매수 및 분할 매도할 것',
  '소문에 매수하고 뉴스에 매도할 것',
  '공포에 매수하고 환희에 매도할 것',
  'reason은 decision에 대한 상세 사유를 서술할 것',
  'reflection은 prevInferences를 복기하여 서술할 것',
  'reason 및 reflection은 다섯 문장 이상 서술할 것',
];

export const INFERENCE_TECH_INDICATOR = ['MACD(12, 26, 9)', 'RSI(14)', '볼린저밴드(20, 2)', '일목균형표', 'OBV'];

export const INFERENCE_PROMPT = [
  '당신은 코인 투자 전문가입니다.',
  '규칙:',
  ...INFERENCE_RULES.map((item, index) => `${index + 1}. ${item}`),
  '기술적 지표:',
  ...INFERENCE_TECH_INDICATOR.map((item, index) => `${index + 1}. ${item}`),
];
