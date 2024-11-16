export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 2048,
  temperature: 0.4,
  topP: 0.75,
  presencePenalty: 0.1,
  frequencyPenalty: 0.1,
  message: {
    candles: {
      m15: 96, // 1 day
      h1: 24 * 7, // 7 days
      h4: 6 * 30, // 30 days
      d1: 90, // 90 days
    },
    newsLimit: 450,
    inferenceLimit: 5 * 6 * 7, // 7 days
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
          orderRatio: {
            type: 'number',
          },
          weightLowerBound: {
            type: 'number',
          },
          weightUpperBound: {
            type: 'number',
          },
          reason: {
            type: 'string',
          },
        },
        required: ['decision', 'orderRatio', 'weightLowerBound', 'weightUpperBound', 'reason'],
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

export const INFERENCE_VALIDATION = {
  decisions: {
    pairs: [
      {
        weightLowerBound: 0,
        weightUpperBound: 0.2,
        description: '현재 포트폴리오 비중 0-20% 구간. 현금 보유량이 많음',
      },
      {
        weightLowerBound: 0.2,
        weightUpperBound: 0.4,
        description: '현재 포트폴리오 비중 20-40% 구간. 현금 보유량이 조금 많음',
      },
      {
        weightLowerBound: 0.4,
        weightUpperBound: 0.6,
        description: '현재 포트폴리오 비중 40-60% 구간. 현금과 종목 보유량이 절반임',
      },
      {
        weightLowerBound: 0.6,
        weightUpperBound: 0.8,
        description: '현재 포트폴리오 비중 60-80% 구간. 종목 보유량이 조금 많음',
      },
      {
        weightLowerBound: 0.8,
        weightUpperBound: 1.0,
        description: '현재 포트폴리오 비중 80-100% 구간. 종목 보유량이 많음',
      },
    ],
    types: {
      values: ['buy', 'sell', 'hold'],
      constraints: {
        hold: 'orderRatio는 반드시 1이어야 함',
      },
    },
    orderRatio: {
      min: 0,
      max: 1,
      description: '매매 비율을 계산해야 함',
    },
  },
  analysis: {
    required: {
      minIndicators: 3,
      crossValidation: [
        {
          primary: 'RSI',
          secondary: ['MACD', '볼린저밴드'],
          description: '과매수/과매도 판단시 보조지표 확인 필수',
        },
        {
          primary: 'CVD',
          secondary: ['파이어차트', '거래량'],
          description: '수급 판단시 매물대 및 거래량 확인 필수',
        },
      ],
      priceAction: {
        required: ['지지/저항 레벨', '추세선', '주요 이동평균선'],
        format: '가격 {price}, 변화율 {change}%, 주요레벨 {levels}',
      },
    },
  },
  reason: {
    minLength: 300,
    maxLength: 500,
    required: [
      {
        type: 'technical',
        minMetrics: 3,
        format: '지표명: 수치 (해석)',
      },
      {
        type: 'fundamental',
        minMetrics: 2,
        format: '뉴스제목: 영향분석',
      },
      {
        type: 'sentiment',
        minMetrics: 2,
        format: '지표명: 수치 (해석)',
      },
    ],
    structure: ['기술적 분석', '펀더멘털 분석', '시장 심리 분석', '최종 판단'],
    requiredKeywords: ['추세', '지지/저항', '변동성', '거래량', '시장심리'],
    sections: [
      {
        name: '가격 분석',
        required: ['현재가격', '변화율', '주요 가격대'],
        minLength: 50,
      },
      {
        name: '기술적 분석',
        required: ['추세', '모멘텀', '변동성'],
        minLength: 100,
      },
      {
        name: '수급 분석',
        required: ['CVD', '파이어차트', '거래량'],
        minLength: 100,
      },
      {
        name: '리스크 분석',
        required: ['손절매 수준', '예상 변동성', '포지션 크기'],
        minLength: 50,
      },
    ],
    errorChecks: ['RSI 과매수/과매도 용어 정확성', '지표간 모순된 해석 여부', '누락된 필수 지표 확인'],
  },
  reflection: {
    minLength: 300,
    maxLength: 500,
    required: ['이전 판단의 정확성', '시장 상황 변화', '개선점'],
  },
  responseExample: {
    decisions: [
      {
        decision: 'buy|sell|hold',
        orderRatio: 0.3,
        weightLowerBound: 0,
        weightUpperBound: 0.2,
        reason: '판단에 대한 이유',
      },
    ],
    symbol: 'BTC/KRW',
    reflection: '이전 추론에 대한 복기 내용',
  },
};

export const INFERENCE_RULES = {
  format: ['JSON 형식으로만 응답할 것', '한국어로 응답할 것'],
  analysis: {
    technical: {
      required: [
        {
          indicator: 'MACD(12, 26, 9)',
          interpretation: ['골든크로스', '데드크로스', '히스토그램 방향'],
          format: '현재값 {value}, 신호선 {signal}, 히스토그램 {histogram}',
        },
        {
          indicator: 'RSI(14)',
          thresholds: [30, 70],
          interpretation: ['과매수', '과매도'],
          format: '현재값 {value}, 구간 {zone}',
        },
        {
          indicator: '볼린저밴드(20, 2)',
          interpretation: ['밴드 위치', '밴드폭 확장/수축'],
          format: '상단 {upper}, 중간 {middle}, 하단 {lower}, 밴드폭 {width}',
        },
        {
          indicator: '일목균형표',
          interpretation: ['전환선/기준선 교차', '구름대 위치'],
          format: '전환선 {conversion}, 기준선 {base}, 선행스팬1 {spanA}, 선행스팬2 {spanB}',
        },
        {
          indicator: 'EMA(50, 200)',
          interpretation: ['골든크로스', '데드크로스', '추세방향'],
          format: 'EMA50 {ema50}, EMA200 {ema200}, 차이 {difference}%',
        },
      ],
    },
    market: {
      required: [
        {
          metric: '거래량',
          comparison: ['전일대비', '20일 평균대비'],
          format: '현재거래량 {volume}, 전일대비 {dayChange}%, 평균대비 {avgChange}%',
        },
        {
          metric: '변동성',
          measurement: 'ATR(14)',
          threshold: 'historical_percentile',
          format: 'ATR {value}, 백분위 {percentile}%',
        },
        {
          metric: '시장지배력',
          measurement: 'dominance_index',
          format: '현재 {value}%, 추세 {trend}',
        },
      ],
    },
    sentiment: {
      required: [
        {
          metric: '공포탐욕지수',
          thresholds: [20, 80],
          interpretation: ['극단공포', '극단탐욕'],
          format: '지수 {value}, 구간 {zone}',
        },
        {
          metric: 'CVD',
          interpretation: ['누적거래량 방향'],
          format: '방향 {direction}, 강도 {strength}',
        },
        {
          metric: '파이어차트',
          interpretation: ['매물대 강도', '지지/저항 구간'],
          format: '강도 {density}, 구간 {zone}',
        },
      ],
    },
  },
  strategy: {
    riskManagement: {
      required: [
        {
          metric: 'stopLoss',
          format: '손절매 가격, {price}, ATR 대비 {atrRatio}배',
        },
        {
          metric: 'positionSize',
          format: 'Kelly Criterion {kelly}%, 제안 비중 {suggested}%',
        },
        {
          metric: 'riskReward',
          format: '예상 손실 {risk}%, 예상 이익 {reward}%, 비율 {ratio}',
        },
      ],
    },
    zoneStrategies: [
      {
        weightLowerBound: 0,
        weightUpperBound: 0.2,
        strategy: '적극적 매수 구간',
        conditions: {
          technical: ['RSI < 30', 'MACD 골든크로스 임박'],
          volume: '평균 이상',
          sentiment: '공포구간',
        },
      },
      {
        weightLowerBound: 0.2,
        weightUpperBound: 0.4,
        strategy: '선별적 매수 구간',
        conditions: {
          technical: ['RSI < 40', '주요 지지선 근접'],
          volume: '평균 대비 증가',
          sentiment: '중립~공포',
        },
      },
      {
        weightLowerBound: 0.4,
        weightUpperBound: 0.6,
        strategy: '중립 구간',
        conditions: {
          technical: ['추세 추종'],
          volume: '평균 수준',
          sentiment: '중립',
        },
      },
      {
        weightLowerBound: 0.6,
        weightUpperBound: 0.8,
        strategy: '선별적 매도 구간',
        conditions: {
          technical: ['RSI > 60', '주요 저항선 근접'],
          volume: '평균 대비 증가',
          sentiment: '중립~탐욕',
        },
      },
      {
        weightLowerBound: 0.8,
        weightUpperBound: 1.0,
        strategy: '적극적 매도 구간',
        conditions: {
          technical: ['RSI > 70', 'MACD 데드크로스 임박'],
          volume: '평균 이상',
          sentiment: '탐욕구간',
        },
      },
    ],
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
      `  ${index + 1}) ${pair.description} (weightLowerBound: ${pair.weightLowerBound}, weightUpperBound: ${pair.weightUpperBound})`,
  )
  .join('\n')}


# 필드별 제약조건
decision:
- 허용값: ${INFERENCE_VALIDATION.decisions.types.values.join(', ')}
${Object.entries(INFERENCE_VALIDATION.decisions.types.constraints)
  .map(([type, constraint]) => `- ${type}: ${constraint}`)
  .join('\n')}

orderRatio:
- ${INFERENCE_VALIDATION.decisions.orderRatio.description}
- ${INFERENCE_VALIDATION.decisions.orderRatio.min}과 ${INFERENCE_VALIDATION.decisions.orderRatio.max} 사이의 숫자만 가능


# 분석 요구사항

## 기술적 분석
각 지표는 다음 형식으로 반드시 포함되어야 합니다:

${INFERENCE_RULES.analysis.technical.required
  .map(
    (indicator) => `
${indicator.indicator}:
- 해석기준: ${indicator.interpretation.join(', ')}
- 표시형식: ${indicator.format}
`,
  )
  .join('\n')}

## 시장 분석
다음 지표들의 분석이 필수적으로 포함되어야 합니다:

${INFERENCE_RULES.analysis.market.required
  .map(
    (metric) => `
${metric.metric}:
- 비교기준: ${metric.comparison ? metric.comparison.join(', ') : metric.measurement}
- 표시형식: ${metric.format}
`,
  )
  .join('\n')}

## 심리 분석
다음 지표들의 분석이 필수적으로 포함되어야 합니다:

${INFERENCE_RULES.analysis.sentiment.required
  .map(
    (metric) => `
${metric.metric}:
- 해석기준: ${metric.interpretation.join(', ')}
- 표시형식: ${metric.format}
`,
  )
  .join('\n')}


# 구간별 매매 전략
각 구간은 다음 전략을 따라야 합니다:

${INFERENCE_RULES.strategy.zoneStrategies
  .map(
    (zone) => `
${zone.weightLowerBound * 100}-${zone.weightUpperBound * 100}% 구간:
- 전략: ${zone.strategy}
- 필요조건:
  * 기술적: ${zone.conditions.technical.join(', ')}
  * 거래량: ${zone.conditions.volume}
  * 심리: ${zone.conditions.sentiment}
`,
  )
  .join('\n')}


# 분석 문서화 요구사항
reason:
- 각 decision마다 다음 내용을 포함해야 함:
  * 최소 ${INFERENCE_VALIDATION.reason.required.map((req) => `${req.type}: ${req.minMetrics}개 지표`).join(', ')}
  * 분석구조: ${INFERENCE_VALIDATION.reason.structure.join(' → ')}
  * 글자수: ${INFERENCE_VALIDATION.reason.minLength}-${INFERENCE_VALIDATION.reason.maxLength}자

reflection:
- 다음 내용을 포함해야 함: ${INFERENCE_VALIDATION.reflection.required.join(', ')}
- 글자수: ${INFERENCE_VALIDATION.reflection.minLength}-${INFERENCE_VALIDATION.reflection.maxLength}자


# 분석 요구사항 보강

## 종합 분석
각 지표는 다음 항목과의 연관성을 반드시 분석해야 합니다:
${INFERENCE_VALIDATION.analysis.required.crossValidation
  .map(
    (validation) => `
${validation.primary} 분석시:
- 보조지표: ${validation.secondary.join(', ')}
- 필수사항: ${validation.description}
`,
  )
  .join('\n')}

## 가격 분석
다음 요소를 반드시 포함해야 합니다:
${INFERENCE_VALIDATION.analysis.required.priceAction.required.map((item) => `- ${item}`).join('\n')}
형식: ${INFERENCE_VALIDATION.analysis.required.priceAction.format}

## 상세 분석 구조
각 구간의 분석은 다음 섹션을 포함해야 합니다:
${INFERENCE_VALIDATION.reason.sections
  .map(
    (section) => `
${section.name}:
- 필수 항목: ${section.required.join(', ')}
- 최소 길이: ${section.minLength}자
`,
  )
  .join('\n')}

## 리스크 관리
각 매매 결정에는 다음 내용이 포함되어야 합니다:
${INFERENCE_RULES.strategy.riskManagement.required
  .map(
    (risk) => `
${risk.metric}:
- 형식: ${risk.format}
`,
  )
  .join('\n')}

## 검증 항목
다음 사항을 반드시 확인해야 합니다:
${INFERENCE_VALIDATION.reason.errorChecks.map((check) => `- ${check}`).join('\n')}


# 응답 예시
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
