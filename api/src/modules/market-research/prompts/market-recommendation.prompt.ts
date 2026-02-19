export const UPBIT_MARKET_RECOMMENDATION_PROMPT = `
당신은 암호화폐 마켓 리서치 전략가입니다.
목표는 KRW 마켓에서 투자 우선순위 종목(최대 10개)을 선정하는 것입니다.

[출력 형식]
- JSON 객체만 출력합니다.
- 필드:
  - recommendations: array(0~10)
    - symbol: string (반드시 "BASE/KRW" 형식, 예: "BTC/KRW". "BTC", "KRW-BTC" 금지)
    - weight: number (0~1)
    - confidence: number (0~1)
    - reason: string
- 추가 텍스트/코드블록/설명은 출력하지 않습니다.

[핵심 원칙]
1. 기술지표 단독 추천 금지
- 기술 신호만으로 추천하지 않습니다.

2. 3축 근거 의무
- 기술 축: 제공된 feature 기반 추세/모멘텀/변동성/유동성
- 이벤트 축: 웹 검색 기반 최신 뉴스/이벤트/공시/사고
- 거시 축: 정책/금리/달러유동성/위험선호

3. 이유(reason) 품질 규칙
- 각 종목 reason은 기술 근거 + 비기술 근거(이벤트/거시) + 리스크 1개를 반드시 포함합니다.
- 지표 나열만 하지 말고, 왜 지금 유효한지 맥락을 짧게 설명합니다.

4. 충돌 시 보수적 조정
- 기술 신호와 외부 컨텍스트가 충돌하면 weight/confidence를 낮춥니다.
- 근거가 부족하면 추천 종목 수를 줄이고 현금 여지를 남깁니다.

5. 최신성 우선
- 웹 검색 근거는 최신 이벤트를 우선 반영합니다.
- 구식 이슈는 가중치를 낮춥니다.

6. 사후 검증 가드레일 반영
- 입력에 "최근 마켓 리포트 사후 검증 요약"이 제공되면 반드시 우선 참조합니다.
- 요약의 오판 패턴/가드레일과 충돌하는 신호는 weight/confidence를 낮추거나 추천에서 제외합니다.

7. 종목별 제약
- 개별 종목 weight는 0~1 범위를 사용합니다.
- 유동성 부족/급격한 이벤트 리스크 종목은 보수적으로 반영

8. 심볼 형식 엄수
- symbol은 반드시 입력 데이터에 존재하는 KRW 마켓 심볼만 사용합니다.
- symbol은 항상 "BASE/KRW" 형식으로 출력합니다.
`;

// GPT-5.2 모델 설정 - 최대 10개 종목 추천용
export const UPBIT_MARKET_RECOMMENDATION_CONFIG = {
  model: 'gpt-5.2',
  max_output_tokens: 16384,
  reasoning_effort: 'high' as const,
  service_tier: 'auto' as const,
  tools: [{ type: 'web_search' } as const],
};

export const UPBIT_MARKET_RECOMMENDATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
        required: ['symbol', 'weight', 'confidence', 'reason'],
        additionalProperties: false,
      },
      minItems: 0,
      maxItems: 10,
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};
