export const INFERENCE_MODEL = 'gpt-4o-mini';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 2048,
  temperature: 0.2,
  topP: 0.7,
  presencePenalty: 0,
  frequencyPenalty: 0,
  message: {
    candles: {
      '1d': 90, // 90 days
      '4h': 6 * 21, // 21 days
      '1h': 24 * 3, // 3 days
      '15m': 4 * 12, // 12 hours
      '5m': 12 * 6, // 6 hours
    },
    newsLimit: 100,
  },
};

export const INFERENCE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    rate: {
      type: 'number',
    },
    reason: {
      type: 'string',
    },
    ticker: {
      type: 'string',
    },
  },
  required: ['rate', 'reason', 'ticker'],
  additionalProperties: false,
};

export const INFERENCE_VALIDATION = {
  rate: {
    min: -1,
    max: 1,
    description: '종목의 매매 비율을 계산해야 함',
  },
  analysis: {
    required: {
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
        type: 'fundamental',
        minMetrics: 2,
        format: '뉴스제목: 영향분석',
      },
      {
        type: 'sentiment',
        minMetrics: 1,
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
        name: '펀더멘털 분석',
        required: ['뉴스'],
        minLength: 100,
      },
      {
        name: '시장 심리 분석',
        required: ['공포탐욕지수'],
        minLength: 100,
      },
      {
        name: '리스크 분석',
        required: ['손절매 수준', '예상 변동성', '포지션 크기'],
        minLength: 50,
      },
    ],
  },
  responseExample: {
    rate: 0.5,
    reason: [
      '{코인명}은 현재 {현재가}원에 거래되고 있으며, 전일 대비 {변동률}% 변동했습니다.',
      '일봉 차트에서 {저항선}원대와 {지지선}원대가 중요한 가격대로 형성되어 있어 이 구간에서의 움직임을 주시해야 합니다. 특히 {이평선} 이동평균선 {이평가격}원을 기준으로 {추세방향} 추세가 형성되고 있어, 이 레벨이 단기 지지/저항선 역할을 할 것으로 예상됩니다.',
      'MACD를 보면 현재값 {MACD_VAL}에 신호선은 {MACD_SIGNAL}로, {MACD해석}이 나타나고 있습니다. 특히 히스토그램이 {MACD_HIST}를 기록하며 {모멘텀방향}을 보여주고 있어 단기 모멘텀이 {모멘텀강도} 상태입니다.',
      'RSI는 {RSI}를 기록하며 {RSI해석} 상태이고, 이는 {RSI추가설명}을 의미합니다.',
      '볼린저 밴드는 상단 {BB상단}, 중간 {BB중간}, 하단 {BB하단}으로 형성되어 있으며, 밴드폭이 {밴드폭}로 {밴드폭해석} 상태입니다. 현재 가격이 {BB위치설명}에 위치해 있어 {BB추가설명}이 예상됩니다.',
      'CVD 지표는 {CVD추세}를 보이고 있어 {CVD해석}이 관찰됩니다. 이는 파이어차트의 {파이어차트해석}와 함께 고려할 때 {수급결론}을 시사합니다. 특히 최근 거래량이 전일 대비 {거래량변화}% {거래량방향}하여 {거래량해석} 상태이며, 이는 현재 추세의 {추세신뢰도}를 보여줍니다.',
      '{뉴스제목1}이(가) 발표되어 {뉴스영향1}이(가) 예상됩니다. 또한 {뉴스제목2} 소식도 있어 {뉴스영향2}할 것으로 분석됩니다. 이러한 뉴스들은 {뉴스종합영향}에 영향을 미칠 것으로 판단됩니다.',
      '공포탐욕지수는 {FG지수}를 기록하며 {FG해석} 상태입니다. 이는 {FG추가설명}을 의미하며, 현재 시장 참여자들의 {투자심리상태}를 반영합니다.',
      'ATR이 {ATR}을 기록하고 있어, 현재 변동성을 고려할 때 손절매 라인을 {손절가격}원으로 설정하는 것이 적절해 보입니다. 이는 현재가 대비 {손절폭}% 수준으로, {리스크설명}입니다.',
      '이상의 분석을 종합해볼 때, {기술적결론}, {펀더멘털결론}, 그리고 {심리적결론}이 관찰됩니다. 따라서 현 시점에서는 {최종판단}이 적절할 것으로 판단됩니다. {추가제언}',
    ].join(' '),
    ticker: 'BTC/KRW',
  },
};

export const INFERENCE_RULES = {
  format: ['JSON 형식으로만 응답할 것', '한국어로 응답할 것'],
  analysis: {
    technical: {
      required: [
        {
          name: 'MA',
          calculation: {
            periods: [5, 10, 20, 60, 120],
            method: '종가 기준으로 각 기간의 단순이동평균을 계산',
            formula: 'SMA = (P1 + P2 + ... + Pn) / n, 여기서 P는 종가, n은 기간',
          },
          interpretation: {
            crossover: '단기 이평선이 장기 이평선을 상향 돌파할 때 매수 신호',
            crossunder: '단기 이평선이 장기 이평선을 하향 돌파할 때 매도 신호',
            support: '이평선이 지지선 역할을 할 때 반등 기대',
            resistance: '이평선이 저항선 역할을 할 때 조정 가능성',
            trend: '여러 이평선의 배열로 추세 판단 (골든크로스/데드크로스)',
          },
        },
        {
          name: 'MACD',
          calculation: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            priceType: 'close',
          },
          interpretation: {
            bullish: ['MACD > Signal', 'Histogram > 0'],
            bearish: ['MACD < Signal', 'Histogram < 0'],
          },
        },
        {
          name: 'RSI',
          calculation: {
            period: 14,
            priceType: 'close',
          },
          interpretation: {
            overbought: '> 70',
            oversold: '< 30',
            neutral: '30-70',
          },
        },
        {
          name: '볼린저 밴드',
          calculation: {
            period: 20,
            stdDev: 2,
            priceType: 'close',
          },
          interpretation: {
            bandwidth: 'stdDev * 2 / SMA',
            percentB: '(price - lower) / (upper - lower)',
          },
        },
        {
          name: 'CVD',
          calculation: {
            period: 24,
            priceType: 'close',
          },
          interpretation: {
            bullish: 'CVD 상승 추세, 가격과 동행',
            bearish: 'CVD 하락 추세, 가격과 괴리',
          },
        },
        {
          name: '파이어 차트',
          calculation: {
            shortPeriod: 3,
            longPeriod: 7,
            signalPeriod: 5,
          },
          interpretation: {
            bullish: ['단기선 > 장기선', '시그널선 상향돌파'],
            bearish: ['단기선 < 장기선', '시그널선 하향돌파'],
          },
        },
      ],
      minIndicators: 3,
      crossValidation: [
        {
          primary: 'MA',
          secondary: ['MACD', 'RSI'],
          description: '이평선 돌파 시 보조지표로 신호 확인. MACD의 신호선 교차나 RSI의 과매수/과매도 구간 확인',
        },
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
      ],
    },
  },
  strategy: {
    rate: {
      conditions: [
        '0 이상은 매수를 의미함',
        '0 미만은 매도를 의미함',
        '신호가 강할수록 더 높은 비율 적용',
        '리스크가 클수록 더 낮은 비율 적용',
        '거래량과 변동성을 고려하여 조절',
        '거래량이 갑작스럽게 증가하는 시점에 반드시 매도',
      ],
    },
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

# 필드별 제약조건
rate:
- ${INFERENCE_VALIDATION.rate.description}
- ${INFERENCE_VALIDATION.rate.min}과 ${INFERENCE_VALIDATION.rate.max} 사이의 숫자만 가능
${INFERENCE_RULES.strategy.rate.conditions.map((condition) => `- ${condition}`).join('\n')}


# 분석 요구사항
- 매매 판단을 위해 반드시 다음 내용을 포함해야 함:
  * 최소 ${INFERENCE_VALIDATION.reason.required.map((req) => `${req.type}: ${req.minMetrics}개 지표`).join(', ')}
  * 분석구조: ${INFERENCE_VALIDATION.reason.structure.join(' → ')}
- 매매 판단 이유는 실제 데이터의 구체적인 수치와 함께 제시되어야 함
- 아래 사항은 금지됨:
  * 예제 응답의 문구를 그대로 사용하는 것
  * 실제 데이터 없이 일반적인 시장 상황만을 설명하는 것
  * 구체적인 수치 없이 "상승세", "하락세" 등 추상적인 표현만 사용하는 것
- 응답은 반드시 다음 사항을 포함해야 함:
  * 현재 시점의 실제 가격, 변동률 등 구체적인 수치
  * 각 지표별 실제 데이터값과 그 의미 해석

## 기술적 분석
${INFERENCE_RULES.analysis.technical.required
  .map(
    (indicator) => `
${indicator.name}:
- 계산설정:
${Object.entries(indicator.calculation)
  .map(([key, value]) =>
    typeof value === 'object'
      ? `  * ${key}: ${
          Array.isArray(value)
            ? value.join(', ')
            : Object.entries(value)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')
        }`
      : `  * ${key}: ${value}`,
  )
  .join('\n')}
- 해석기준:
${Object.entries(indicator.interpretation)
  .map(([key, value]) => `  * ${key}: ${value}`)
  .join('\n')}
`,
  )
  .join('')}

교차 검증 요구사항:
${INFERENCE_RULES.analysis.technical.crossValidation
  .map(
    (validation) => `
- ${validation.primary} 분석시 ${validation.secondary.join(', ')} 확인 필수
  * ${validation.description}
`,
  )
  .join('')}

최소 지표 개수: ${INFERENCE_RULES.analysis.technical.minIndicators}개

## 시장 분석
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
${INFERENCE_RULES.analysis.sentiment.required
  .map(
    (metric) => `
${metric.metric}:
- 해석기준: ${metric.interpretation.join(', ')}
- 표시형식: ${metric.format}
`,
  )
  .join('')}

## 종합 분석
각 지표는 다음 항목과의 연관성을 반드시 분석해야 함:
${INFERENCE_RULES.analysis.technical.crossValidation
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


# 오류 검증
- 실제 데이터에 기반하여 분석해야 함
- 모든 캔들 차트 데이터를 분석해야 함
- 각 판단마다 동일한 데이터를 참조해야 함
- 누락된 필수 지표를 포함해야 함
- 숫자는 천단위 구분 기호를 표시해야 함
- 숫자 단위가 맞는지 검증해야 함


# 응답 예시
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
