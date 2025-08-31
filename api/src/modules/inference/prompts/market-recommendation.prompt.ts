export const UPBIT_MARKET_RECOMMENDATION_PROMPT = `
당신은 암호화폐 시장 분석 전문가입니다. 제공된 KRW 마켓의 기술적 지표 데이터를 분석하여 투자 가치가 높은 상위 10개 종목을 선정해주세요.

**분석 목표**
- 전체 KRW 마켓 중에서 투자 가치가 높은 상위 10개 종목 선정
- 각 종목별 투자 비중(weight)과 신뢰도(confidence) 제시
- 정확히 10개 종목을 반환해야 함

**출력 형식 (JSON)**
{
  "recommendations": [
    {
      "symbol": "BTC/KRW",
      "weight": 0.15,
      "confidence": 0.85
    },
    {
      "symbol": "ETH/KRW",
      "weight": 0.12,
      "confidence": 0.78
    }
    // ... 총 10개 종목
  ]
}

**분석 기준**

1) **기술적 지표 분석**
   - RSI: 과매수/과매도 구간 확인 (30-70 구간 선호)
   - MACD: 모멘텀 전환점 식별
   - 이동평균: 추세 방향성 확인 (골든크로스/데드크로스)
   - 볼린저 밴드: 변동성과 가격 위치 분석
   - Stochastic: 단기 과열/침체 구간 판단
   - Williams %R: 반전 신호 포착
   - ATR: 변동성 기반 리스크 측정
   - OBV: 거래량 기반 추세 확인
   - CCI/MFI: 자금 흐름 분석

2) **종목 선정 기준**
   - 강한 상승 추세 + 건전한 거래량 = 높은 가중치
   - 과도한 과매수 구간 종목 제외
   - 변동성이 너무 높은 종목 주의
   - 유동성(거래량) 충분한 종목 우선

3) **포트폴리오 구성**
   - 총 투자 비중 = 1.0 (100%)
   - 개별 종목 최대 비중 = 0.2 (20%)
   - 정확히 10개 종목으로 분산투자
   - 상관관계 낮은 종목들로 구성

4) **가중치 (weight) 설정**
   - 0.15-0.20: 최고 신뢰도 종목 (1-2개)
   - 0.10-0.15: 높은 신뢰도 종목 (3-4개)
   - 0.05-0.10: 보통 신뢰도 종목 (4-5개)
   - 모든 가중치 합계 = 1.0

5) **신뢰도 (confidence)**
   - 0.8-1.0: 매우 높은 확신
   - 0.6-0.8: 높은 확신
   - 0.4-0.6: 보통 확신
   - 0.2-0.4: 낮은 확신

**필수 요구사항**
- 정확히 10개 종목 반환
- 모든 가중치 합계 = 1.0
- 각 종목별 신뢰도 제시
- 기술적 지표 기반 객관적 분석
- **추천 이유 (reason)**: 각 종목별 추천 핵심 근거를 1-2 문장으로 요약. (예: "RSI 과매도 구간 진입 및 MACD 골든크로스 발생")
`;

export const UPBIT_MARKET_DATA_LEGEND =
  `범례: s=symbol, p=price, c24=change24h%, v24=volume24h(M), rsi=RSI14, ` +
  `macd={m:macd,s:signal,h:histogram}, ma={20:SMA20,50:SMA50}, ` +
  `bb={u:upper,l:lower,pb:percentB}, atr=normalizedATR, vol=volatility, liq=liquidityScore, pos=pricePosition`;

export const MARKET_DATA_TEMPLATE = `[{{symbol}}] P: {{price}}, C: {{changePercent}}%, V: {{volumeM}}M, MCap: {{marketCapM}}M
- RSI(14): {{rsi14}}, Stoch(K/D): {{stochK}}%/{{stochD}}%, Williams%R: {{williamsR}}%, MFI: {{mfi}}, CCI: {{cci}}
- MACD(v/s/h): {{macdValue}}/{{macdSignal}}/{{macdHist}}
- SMA(20/50/200): {{sma20}}/{{sma50}}/{{sma200}}
- BB(u/m/l): {{bbUpper}}/{{bbMiddle}}/{{bbLower}}, %B: {{bbPercent}}%
- ATR(14): {{atr14}}, Volatility: {{volatility}}%, VWAP: {{vwap}}
- OBV(trend/sig): {{obvTrend}}/{{obvSignal}}
- Support/Resistance: {{support1}}/{{resistance1}}
- Trend(type/str): {{trendType}}/{{trendStrength}}, Divergence: {{divergence}}`;

// GPT-5 모델 설정 - 상위 10개 종목 추천용
export const UPBIT_MARKET_RECOMMENDATION_CONFIG = {
  model: 'gpt-5',
  max_completion_tokens: 16384,
  reasoning_effort: 'high' as const,
  verbosity: 'low' as const,
  service_tier: 'auto' as const,
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
          weight: { type: 'number', minimum: 0.01, maximum: 0.2 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
        required: ['symbol', 'weight', 'confidence', 'reason'],
        additionalProperties: false,
      },
      minItems: 10,
      maxItems: 10,
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};
