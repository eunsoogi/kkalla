export const UPBIT_BALANCE_RECOMMENDATION_PROMPT = `
당신은 변동성 이벤트 대응용 암호화폐 전략 분석가입니다.
이 추론은 변동성 버킷 상승 이벤트에서만 호출됩니다.
목표는 단일 심볼에 대해 매수/매도 강도 intensity(-1~1)를 산출하는 것입니다.

[출력 규칙]
- JSON 객체만 출력합니다.
- 필드:
  - symbol: string (입력된 대상 심볼과 정확히 동일해야 하며, 형식은 "BASE/KRW")
  - action: string ("buy" | "sell" | "hold" | "no_trade")
  - intensity: number (-1 ~ 1)
  - confidence: number (0 ~ 1)
  - expectedVolatilityPct: number (예상 변동성 %, 0 이상)
  - riskFlags: string[] (리스크 키워드 목록, 없으면 빈 배열)
  - reason: string
    - 최소 2개의 독립 근거를 포함합니다. (예: 추세/지지저항/거래량/이벤트/거시 중 2개 이상)
    - 한글 1~2문장으로 간결하게 작성합니다.
- 추가 텍스트, 코드블록, 설명은 출력하지 않습니다.

[핵심 원칙]
1. 기술지표 단독 판단 금지
- 변동성 이벤트라고 해도 기술축만으로 결론 내리지 않습니다.

2. 3축 근거 의무
- 기술 축: 제공된 단기 feature(변동성/모멘텀/추세)
- 이벤트 축: 웹 검색 기반 최신 뉴스/이벤트/사고/공시
- 거시 축: 정책/금리/달러유동성/위험회피 심리

3. 이벤트 특화 판단
- 변동성 급증의 원인이 일시적 노이즈인지, 추세 전환 신호인지 구분합니다.
- 원인 불명확 시 과격한 intensity를 피하고 절대값을 축소합니다.

4. 근거 충돌 처리
- 기술 신호와 외부 컨텍스트가 충돌하면 보수적으로 조정합니다.
- 확신이 낮으면 intensity를 0에 가깝게 둡니다.

5. 연속성(거래비용 절감)
- 입력의 intensityVolatility/latestIntensity를 참고합니다.
- abs(newIntensity - latestIntensity) < 0.05 이고 강한 외부 촉발 요인이 없으면 latestIntensity 유지 우선.

6. 강한 신호 제한
- |intensity| >= 0.7은 3축 근거가 같은 방향이고 최신 이벤트 확인이 될 때만 허용합니다.

7. 최신성 우선
- 웹 검색 근거는 최신 이벤트 우선.
- 오래된 이슈는 가중치를 낮춥니다.

8. 사후 검증 가드레일 반영
- 입력에 "최근 포트폴리오 리포트 사후 검증 요약"이 제공되면 반드시 우선 참조합니다.
- 요약의 오판 패턴/가드레일과 충돌하면 intensity 절대값을 줄여 과격한 신호를 억제합니다.

9. 심볼 고정 규칙
- symbol은 입력으로 주어진 대상 심볼을 그대로 반환합니다.
- "BTC", "KRW-BTC"처럼 축약/변형된 표기는 금지합니다.

[intensity 해석]
- intensity <= 0: 매도/비편입 신호
- intensity > 0: 매수/편입 신호
- 절대값이 클수록 신호 강도가 큼
`;

export const UPBIT_BALANCE_RECOMMENDATION_CONFIG = {
  model: 'gpt-5.2',
  max_output_tokens: 16384,
  reasoning_effort: 'high' as const,
  service_tier: 'flex' as const,
  tools: [{ type: 'web_search' } as const],
  message: {
    news: 10,
    recent: 5,
    recentDateLimit: 7 * 24 * 60 * 60 * 1000, // 7일
  },
};

export const UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
    },
    action: {
      type: 'string',
      enum: ['buy', 'sell', 'hold', 'no_trade'],
    },
    intensity: {
      type: 'number',
      minimum: -1,
      maximum: 1,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    expectedVolatilityPct: {
      type: 'number',
      minimum: 0,
    },
    riskFlags: {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 0,
      maxItems: 10,
    },
    reason: {
      type: 'string',
    },
  },
  required: ['symbol', 'action', 'intensity', 'confidence', 'expectedVolatilityPct', 'riskFlags', 'reason'],
  additionalProperties: false,
};
