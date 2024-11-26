export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 4096,
  temperature: 0.2,
  topP: 0.7,
  presencePenalty: 0,
  frequencyPenalty: 0,
  message: {
    candles: {
      m15: 96 * 7, // 7 days
      h1: 24 * 14, // 14 days
      h4: 6 * 60, // 60 days
      d1: 90, // 90 days
    },
    newsLimit: 300,
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
  },
  required: ['decisions', 'symbol'],
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
    minLength: 800,
    maxLength: 1000,
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
    errorChecks: [
      '실제 데이터에 기반하여 분석해야 함',
      '각 판단마다 동일한 데이터를 참조해야 함',
      '누락된 필수 지표를 포함해야 함',
    ],
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
각 지표는 다음 형식으로 반드시 포함되어야 함:

${INFERENCE_RULES.analysis.technical.required
  .map(
    (indicator) => `
${indicator.indicator}:
- 해석기준: ${indicator.interpretation.join(', ')}
- 표시형식: ${indicator.format}
`,
  )
  .join('')}

## 시장 분석
다음 지표들의 분석이 반드시 포함되어야 함:

${INFERENCE_RULES.analysis.market.required
  .map(
    (metric) => `
${metric.metric}:
- 비교기준: ${metric.comparison ? metric.comparison.join(', ') : metric.measurement}
- 표시형식: ${metric.format}
`,
  )
  .join('')}

## 심리 분석
다음 지표들의 분석이 반드시 포함되어야 함:

${INFERENCE_RULES.analysis.sentiment.required
  .map(
    (metric) => `
${metric.metric}:
- 해석기준: ${metric.interpretation.join(', ')}
- 표시형식: ${metric.format}
`,
  )
  .join('')}


# 분석 문서화 요구사항
reason:
- 각 decision마다 반드시 다음 내용을 포함해야 함:
  * 최소 ${INFERENCE_VALIDATION.reason.required.map((req) => `${req.type}: ${req.minMetrics}개 지표`).join(', ')}
  * 분석구조: ${INFERENCE_VALIDATION.reason.structure.join(' → ')}
- 반드시 ${INFERENCE_VALIDATION.reason.minLength}~${INFERENCE_VALIDATION.reason.maxLength}글자여야 함


# 분석 요구사항 보강

## 종합 분석
각 지표는 다음 항목과의 연관성을 반드시 분석해야 함:
${INFERENCE_VALIDATION.analysis.required.crossValidation
  .map(
    (validation) => `
${validation.primary} 분석시:
- 보조지표: ${validation.secondary.join(', ')}
- 필수사항: ${validation.description}
`,
  )
  .join('')}

## 가격 분석
다음 요소를 반드시 포함해야 함:
${INFERENCE_VALIDATION.analysis.required.priceAction.required.map((item) => `- ${item}`).join('\n')}
형식: ${INFERENCE_VALIDATION.analysis.required.priceAction.format}

## 상세 분석 구조
각 구간의 분석은 다음 섹션을 포함해야 함:
${INFERENCE_VALIDATION.reason.sections
  .map(
    (section) => `
${section.name}:
- 필수 항목: ${section.required.join(', ')}
- 최소 길이: ${section.minLength}자
`,
  )
  .join('')}

## 리스크 관리
각 매매 결정에는 다음 내용이 포함되어야 함:
${INFERENCE_RULES.strategy.riskManagement.required
  .map(
    (risk) => `
${risk.metric}:
- 형식: ${risk.format}
`,
  )
  .join('')}

## 검증 항목
다음 사항을 반드시 확인해야 함:
${INFERENCE_VALIDATION.reason.errorChecks.map((check) => `- ${check}`).join('\n')}


# 응답 예시
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
