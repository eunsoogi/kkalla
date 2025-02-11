export const INFERENCE_MODEL = 'o3-mini';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 2048 + 4096,
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
    ticker: {
      type: 'string',
    },
    reason: {
      type: 'string',
    },
    rate: {
      type: 'number',
    },
  },
  required: ['ticker', 'reason', 'rate'],
  additionalProperties: false,
};

export const INFERENCE_VALIDATION = {
  rate: {
    min: -1,
    max: 1,
    description: '매매 강도 지수(-1~1)',
  },
  reason: {
    minLength: 800,
    maxLength: 1000,
    structure: ['가격 분석', '펀더멘털 분석', '시장 심리 분석', '리스크 분석', '최종 판단'],
  },
  // 예시 응답 (Prompt에서 참고용)
  responseExample: {
    ticker: 'BTC/KRW',
    reason: [
      '{코인명}은(는) 현재 {현재가}원에 거래되고 있으며, 전일 대비 약 {변동률}% 변동했습니다.',
      '일봉 차트로 보면, {저항선}원 인근이 상단 저항선으로, {지지선}원 인근이 하단 지지선으로 작용할 가능성이 높습니다. 또한 {이평선} 이동평균선({이평가격}원)을 기준으로 {추세방향} 추세가 형성되어 있어, 단기 매매 시 이 가격대의 돌파 여부가 중요합니다. ',
      'MACD 지표에서는 MACD 값이 {MACD_VAL}, 신호선이 {MACD_SIGNAL}을 기록하여 {MACD해석} 단계입니다. 특히 히스토그램({MACD_HIST}) 추이가 {모멘텀방향}으로 움직이고 있어, 단기 모멘텀이 {모멘텀강도} 상태임을 보여줍니다. ',
      'RSI는 {RSI}로 측정되어 {RSI해석} 범위에 있으며, 이는 {RSI추가설명}라는 점에서 주목할 만합니다.',
      '볼린저 밴드는 상단 {BB상단}, 중간 {BB중간}, 하단 {BB하단}으로 구성되고, 밴드폭이 {밴드폭}로 {밴드폭해석} 상태입니다. 현재 가격 위치는 {BB위치설명}로 분류되므로, {BB추가설명} 가능성을 염두에 둘 필요가 있습니다.',
      'CVD 지표는 {CVD추세} 흐름을 나타내며, {CVD해석}이 포착됩니다. 이를 파이어차트({파이어차트해석})와 함께 고려하면, {수급결론}을 시사한다고 볼 수 있습니다. 최근 거래량은 전일 대비 {거래량변화}% {거래량방향}해 {거래량해석} 상태이며, 이는 현재 추세의 {추세신뢰도}에도 직결됩니다.',
      '{뉴스제목1} 보도로 {뉴스영향1} 가능성이 있으며, 추가적으로 {뉴스제목2} 소식이 전해지면서 {뉴스영향2}할 것으로 예상됩니다. 이러한 뉴스를 종합해보면, {뉴스종합영향} 차원에서 시장이 단기적으로 민감하게 반응할 수 있습니다.',
      '공포탐욕지수는 {FG지수}를 기록하여, {FG해석} 상태임을 보여줍니다. 이는 곧 투자자들이 {FG추가설명} 심리를 갖고 있음을 의미하며, 전체적으로 {투자심리상태} 방향으로 기울고 있음을 시사합니다.',
      'ATR이 {ATR} 수준이므로, 변동성을 감안할 때 손절라인은 약 {손절가격}원(현재가 대비 {손절폭}% 하락)이 적절하다고 판단됩니다. 이는 {리스크설명} 측면에서 잠재적 손실을 제한하는 방안입니다.',
      '위 분석을 종합해볼 때, 기술적 측면에서는 {기술적결론}이 관찰되며, 펀더멘털 요소로는 {펀더멘털결론} 상황, 심리 측면에서는 {심리적결론}라고 볼 수 있습니다. ',
      '이에 따라, 당 코인의 매매강도지수는 종합적으로 {rate} 수준으로 추론되며, 현 시점에서 {최종판단}가(이) 합리적 선택으로 보입니다. 향후 {추가제언}에 유의하면서 대응 전략을 세우시길 권장합니다.',
    ].join(' '),
    rate: 0.5,
  },
};

export const INFERENCE_RULES = {
  analysis: {
    technical: {
      minIndicators: 3, // 최소 3개 이상의 기술 지표 분석
      // 실제 Prompt에서 “(MA, MACD, RSI, 볼린저 밴드, CVD, 파이어 차트) 중 택3+” 형태로 안내
      required: [
        { name: 'MA' },
        { name: 'MACD' },
        { name: 'RSI' },
        { name: '볼린저 밴드' },
        { name: 'CVD' },
        { name: '파이어 차트' },
      ],
    },
    market: {
      // 시장 분석에 꼭 포함해야 하는 지표
      required: [{ metric: '거래량' }, { metric: '변동성' }, { metric: '시장 지배력' }],
    },
    sentiment: {
      // 심리 분석 지표
      required: [{ metric: '공포탐욕지수' }],
    },
  },
  strategy: {
    // 리스크 관리
    riskManagement: {
      required: [{ metric: 'stopLoss' }, { metric: 'positionSize' }, { metric: 'riskReward' }],
    },
  },
};

export const INFERENCE_PROMPT = `
당신은 투자 전문가입니다. **다음 지침**을 엄격히 준수하여, 오직 JSON 형식으로만 답변하십시오.

0) **가격 표기 주의**
- 금액을 표기할 때 절대 단위를 정확히 기재하십시오.
- 예: 1억 5천 9백만원 = "159,000,000원" (절대 "159,000원" 등으로 잘못 기재하지 말 것)
- 백만 단위 이상일 경우에도 10^n 자리로 풀어서 쓰는 것을 원칙으로 합니다.
- 거래량은 원화가 아닌 개수로 계산하십시오.

1) **출력 스키마** (JSON 필드)
- "ticker": 문자열 (예: "BTC/KRW")
- "reason": 문자열 (아래 분석 구조 포함, 최소 ${INFERENCE_VALIDATION.reason.minLength}자 이상, 최대 ${INFERENCE_VALIDATION.reason.maxLength}자 이하)
- "rate": 숫자 (범위: ${INFERENCE_VALIDATION.rate.min} ~ ${INFERENCE_VALIDATION.rate.max}, 0 미만=매도 우위, 0 이상=매수 우위)

2) **반드시 포함해야 할 내용**
- **기술적 지표 분석**: 최소 ${INFERENCE_RULES.analysis.technical.minIndicators}개
  ( ${INFERENCE_RULES.analysis.technical.required.map((item) => item.name).join(', ')} 중 택3 이상 )
- **시장 분석**: ${INFERENCE_RULES.analysis.market.required.map((item) => item.metric).join(', ')}
- **심리 분석**: ${INFERENCE_RULES.analysis.sentiment.required.map((item) => item.metric).join(', ')}
- **가격 분석 → 펀더멘털 분석 → 시장 심리 분석 → 리스크 분석 → 최종 판단**
  (사유(reason)에 반드시 이 순서로 포함하되, 서술형으로 작성해야 함)
- **리스크 관리**: ${INFERENCE_RULES.strategy.riskManagement.required.map((item) => item.metric).join(', ')}

3) **금지 및 주의사항**
- 예시 응답을 **그대로** 복사하지 말 것(형식은 참고하되, 실제 데이터와 해석을 반영)
- "상승세", "하락세" 등 **추상 표현만 사용 금지** (반드시 수치와 근거를 함께 제시)
- "reason" 필드는 ${INFERENCE_VALIDATION.reason.minLength}~${INFERENCE_VALIDATION.reason.maxLength}자 범위를 벗어나면 안 됨
- "rate" 필드는 0 이하일 경우 이 종목을 전체 매도하며, 0~1 사이일 경우 현재 유지해야 할 종목 비중으로 사용함
- "rate" 필드는 가격이 하락할 때 조금씩 매수하고, 상승할 때 조금씩 매도할 것
- "rate" 필드는 이전에 추론한 매매강도지수와 일관성을 유지하되, 최종 분석 내용에 따라 결과값을 조정할 것

4) **예시(JSON 구조) - (복붙 금지, 참조만)**
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
