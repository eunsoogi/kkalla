export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 2048,
  temperature: 0.4,
  topP: 0.75,
  presencePenalty: 0.1,
  frequencyPenalty: 0.1,
  message: {
    candles: {
      m15: 96,
      h1: 24 * 7,
      h4: 6 * 30,
      d1: 90,
    },
    newsLimit: 5000,
    inferenceLimit: 6 * 7,
  },
};

export const INFERENCE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          decision: {
            type: 'string',
            enum: ['buy', 'sell', 'hold'],
          },
          rate: {
            type: 'number',
          },
          symbolRateLower: {
            type: 'number',
          },
          symbolRateUpper: {
            type: 'number',
          },
          reason: {
            type: 'string',
          },
        },
        required: ['decision', 'rate', 'symbolRateLower', 'symbolRateUpper', 'reason'],
        additionalProperties: false,
      },
    },
    symbol: {
      type: 'string',
    },
    reflection: {
      type: 'string',
    },
  },
  required: ['decisions', 'symbol', 'reflection'],
  additionalProperties: false,
};

export const INFERENCE_RULES = {
  format: ['JSON 형식으로만 응답할 것', '한국어로 응답할 것'],
  analysis: {
    required: [
      '캔들 차트',
      '뉴스',
      '공포탐욕지수',
      '기술적 지표',
      'CVD 지표',
      '파이어차트',
      '거래량 프로파일',
      '시장 지배력 지수',
    ],
    technicalIndicators: [
      'MACD(12, 26, 9)',
      'RSI(14)',
      '볼린저밴드(20, 2)',
      '일목균형표',
      'OBV',
      'CVD',
      '파이어차트',
      'ATR(14)',
      'EMA(50, 200)',
      'DMI(14)',
    ],
  },
  strategy: [
    '분할 매수/매도 원칙 준수',
    '소문에 매수, 뉴스에 매도',
    '공포에 매수, 환희에 매도',
    '최신 뉴스에 가중치 부여',
    '변동성 급증 구간 매매 신중',
    '거래량 동반 확인 필수',
    '시장 지배력 변화 고려',
  ],
};

export const INFERENCE_VALIDATION = {
  decisions: {
    pairs: [
      { symbolRateLower: 0, symbolRateUpper: 0.2, description: '현금 대비 종목 비율 0-20% 구간' },
      { symbolRateLower: 0.2, symbolRateUpper: 0.4, description: '현금 대비 종목 비율 20-40% 구간' },
      { symbolRateLower: 0.4, symbolRateUpper: 0.6, description: '현금 대비 종목 비율 40-60% 구간' },
      { symbolRateLower: 0.6, symbolRateUpper: 0.8, description: '현금 대비 종목 비율 60-80% 구간' },
      { symbolRateLower: 0.8, symbolRateUpper: 1.0, description: '현금 대비 종목 비율 80-100% 구간' },
    ],
    types: {
      values: ['buy', 'sell', 'hold'],
      constraints: {
        hold: 'rate는 반드시 0이어야 함',
      },
    },
    rate: {
      min: 0,
      max: 1,
      description: '매매 비율을 계산해야 함',
    },
  },
  documentation: {
    reason: {
      minSentences: 5,
      maxSentences: 10,
      requiredAnalysis: [
        '캔들 차트 분석',
        '뉴스 분석',
        '공포탐욕지수 분석',
        '기술적 지표 분석',
        'CVD 지표 분석',
        '파이어차트 분석',
      ],
      requiredKeywords: ['추세', '지지/저항', '변동성', '거래량', '시장심리'],
    },
    reflection: {
      minSentences: 5,
      maxSentences: 10,
      required: 'prevInferences 데이터가 있는 경우 분석하고, decision에 영향 주지 말아야 함',
    },
  },
  responseExample: {
    decisions: [
      {
        decision: 'buy|sell|hold',
        rate: 0.3,
        symbolRateLower: 0,
        symbolRateUpper: 0.2,
        reason: '판단에 대한 이유',
      },
    ],
    symbol: 'BTC/KRW',
    reflection: '이전 추론에 대한 복기 내용',
  },
};

export const INFERENCE_PROMPT = `
당신은 투자 전문가입니다. 다음 규칙에 따라 투자 분석과 결정을 수행하십시오:

# 응답 구조 요구사항
decisions:
- 반드시 다음 5개의 구간을 순서대로 포함해야 함:
${INFERENCE_VALIDATION.decisions.pairs
  .map(
    (pair, index) =>
      `  ${index + 1}) ${pair.description} (symbolRateLower: ${pair.symbolRateLower}, symbolRateUpper: ${pair.symbolRateUpper})`,
  )
  .join('\n')}

# 필드별 제약조건
decision:
- 허용값: ${INFERENCE_VALIDATION.decisions.types.values.join(', ')}
${Object.entries(INFERENCE_VALIDATION.decisions.types.constraints)
  .map(([type, constraint]) => `- ${type}: ${constraint}`)
  .join('\n')}

rate:
- ${INFERENCE_VALIDATION.decisions.rate.description}
- ${INFERENCE_VALIDATION.decisions.rate.min}과 ${INFERENCE_VALIDATION.decisions.rate.max} 사이의 숫자만 가능

reason:
- 각 decision마다 ${INFERENCE_VALIDATION.documentation.reason.minSentences}문장 이상~${INFERENCE_VALIDATION.documentation.reason.maxSentences}문장 이하의 분석 내용 필수
- 반드시 다음 항목을 모두 포함해야 함:
${INFERENCE_VALIDATION.documentation.reason.requiredAnalysis.map((item) => `  * ${item}`).join('\n')}
- 필수 키워드 포함:
${INFERENCE_VALIDATION.documentation.reason.requiredKeywords.map((keyword) => `  * ${keyword}`).join('\n')}

reflection:
- ${INFERENCE_VALIDATION.documentation.reflection.minSentences}문장 이상~${INFERENCE_VALIDATION.documentation.reflection.maxSentences}문장 이하의 복기 내용 필수
- ${INFERENCE_VALIDATION.documentation.reflection.required}

# 필수 분석 지표
기술적 지표:
${INFERENCE_RULES.analysis.technicalIndicators.map((item) => `- ${item}`).join('\n')}

추가 분석 지표:
${INFERENCE_RULES.analysis.required.map((item) => `- ${item}`).join('\n')}

# 매매 전략
${INFERENCE_RULES.strategy.map((item) => `- ${item}`).join('\n')}

# 응답 예시
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
