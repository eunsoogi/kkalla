export const INFERENCE_MODEL = 'o3';

export const INFERENCE_CONFIG = {
  maxCompletionTokens: 2048 + 4096,
  message: {
    candles: {
      '1d': 50, // 50 days (장기 추세)
      '4h': 7 * 6, // 7 days (중단기 추세)
      '1h': 3 * 24, // 3 days (단기 추세)
      '15m': 12 * 4, // 12 hours (진입점 분석)
    },
    newsLimit: 100,
    newsImportanceLower: 3,
    recentLimit: 5,
    recentDateLimit: 6 * 60 * 60 * 1000, // 6시간
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
    description: '보유비중(-1~1)',
  },
  reason: {
    minLength: 800,
    maxLength: 1200,
    structure: ['가격 분석', '기술적 분석', '펀더멘털 분석', '시장 분석', '심리 분석', '리스크 분석', '최종 판단'],
  },
  // 예시 응답 (Prompt에서 참고용)
  responseExample: {
    ticker: 'BTC/KRW',
    reason: [
      // 가격 분석
      'BTC/KRW은 현재 [가격]에 거래되고 있으며, 전일 대비 [증감률] 상승했습니다. 일봉 차트 분석 결과, [저항선 가격]이 단기 저항선으로, [지지선 가격]이 주요 지지선으로 작용하고 있습니다. 현재 50일 이동평균선과 200일 이동평균선 모두 상향 배열 중이며, 가격이 두 이평선 위에 위치해 중기적 상승 추세가 확인됩니다.',

      // 기술적 분석
      'MACD 지표는 현재 값이 신호선보다 높게 형성되어 있어 상승 모멘텀이 유지되고 있습니다. 특히 히스토그램이 [일수] 연속 확대되며 모멘텀 강화를 시사합니다. RSI는 현재 [RSI 값]로 다소 과열 구간에 근접했으나 아직 극단적 과매수(70 이상) 수준은 아닙니다. 볼린저 밴드의 밴드폭이 전주 대비 [비율] 확대되어 변동성이 증가하는 추세입니다. 현재 가격은 중간선과 상단선 사이에 위치하여 상승 압력이 우세하나, 상단선 접근 시 저항을 받을 가능성도 있습니다.',

      // 펀더멘털 분석
      '최근 "美 SEC, 현물 비트코인 ETF 추가 승인" 보도는 시장에 긍정적인 영향을 미쳤으며, "주요 기업들의 비트코인 보유량 증가" 소식이 제도권 수용도 확대를 시사합니다. 온체인 데이터에 따르면 장기 보유자(1년 이상) 비율이 높은 수준을 기록하고 있어 매도 압력이 제한적일 것으로 예상됩니다. 비트코인 네트워크의 해시레이트는 지난 달 대비 증가하여 네트워크 보안이 강화되고 있습니다.',

      // 시장 분석
      '최근 거래량은 [일수]일 평균 대비 증가한 상태로, 가격 상승이 거래량 증가와 함께 일어나 추세의 신뢰도가 높은 상황입니다. 변동성(ATR)은 지난 주 대비 확대되었으며, 이는 큰 방향성 움직임의 전조로 볼 수 있습니다. 비트코인의 시장 지배력은 현재 안정적이며, 이는 알트코인 대비 상대적 강세를 유지하고 있음을 보여줍니다.',

      // 심리 분석
      '공포탐욕지수는 현재 [지수값](탐욕)를 기록하고 있어, 투자자들의 낙관적 심리가 우세함을 나타냅니다. 다만 이 수치는 [기간] 전 수치에서 상승한 것으로, 과도한 낙관론으로 인한 조정 가능성도 염두에 두어야 합니다. 옵션 시장에서는 콜옵션 거래 비중이 풋옵션 대비 높아 상승 기대감이 큰 상황입니다.',

      // 리스크 관리
      'ATR 기준 적정 손절매 라인은 현재가 대비 [비율] 하락한 수준으로 판단됩니다. 포트폴리오 내 비트코인 비중은 총 암호화폐 자산의 [비율]%를 넘지 않는 것이 리스크 관리 측면에서 합리적입니다. 현재 예상 리스크 대비 보상 비율은 적절한 수준으로 계산되어 투자 효율성이 양호한 상태입니다.',

      // 최종 판단
      '종합적으로 볼 때, 기술적 지표들은 상승 모멘텀이 유지되는 가운데 일부 과열 신호가 감지되는 상황이며, 펀더멘털은 기관 투자자들의 유입과 온체인 지표 개선으로 견고합니다. 시장 심리는 낙관적이나 과도한 낙관으로 인한 단기 조정 가능성도 존재합니다. 이를 종합하여 현재 BTC/KRW의 적정 보유비중은 [비율](중립~매수)로 판단되며, 분할 매수 전략으로 접근하는 것이 합리적입니다. 추가 상승 시 주요 저항선 돌파 여부에 따라 포지션을 조정하는 전략을 권장합니다.',
    ].join(' '),
    rate: 0.5,
  },
};

export const INFERENCE_RULES = {
  analysis: {
    technical: {
      minIndicators: 3, // 최소 3개 이상의 기술 지표 분석
      required: [
        { name: 'MA' },
        { name: 'MACD' },
        { name: 'RSI' },
        { name: '볼린저 밴드' },
        { name: 'CVD' },
        { name: '파이어 차트' },
      ],
      // 기술적 지표 자동 계산 규칙 추가
      calculations: {
        movingAverage: {
          name: 'MA',
          periods: [20, 50, 200], // 이동평균선 기간
          crossoverSignificance: 0.03, // 골든/데드 크로스 유의미 갭(%)
          trendConfirmation: 10, // 추세 확인을 위한 일수
        },
        macd: {
          name: 'MACD',
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          divergenceThreshold: 0.2, // 다이버전스 감지 임계값
        },
        rsi: {
          name: 'RSI',
          period: 14,
          overbought: 70, // 과매수 레벨
          oversold: 30, // 과매도 레벨
          divergenceDetection: true, // 다이버전스 감지 활성화
        },
        bollingerBands: {
          name: '볼린저 밴드',
          period: 20,
          deviations: 2, // 표준편차 배수
          bandwidthThreshold: 0.1, // 밴드폭 임계값(%)
          squeezeDetection: true, // 스퀴즈 감지 활성화
        },
        cumulativeVolumeDelta: {
          name: 'CVD',
          period: 30, // 누적 거래량 분석 기간
          volumeThreshold: 1.5, // 평균 대비 유의미한 거래량 배수
        },
        orderBookDepth: {
          name: '파이어 차트',
          depthLevels: 5, // 주문장 깊이 레벨
          resistanceThreshold: 1.2, // 저항선 임계값 배수
          supportThreshold: 1.2, // 지지선 임계값 배수
        },
      },
      interpretations: {
        bullish: [
          '상승 추세 확인',
          '골든 크로스 발생',
          'RSI 과매도에서 반등',
          'MACD 상승 다이버전스',
          '볼린저 밴드 하단에서 반등',
          'CVD 상승 추세',
          '매수세 우위 확인',
        ],
        bearish: [
          '하락 추세 확인',
          '데드 크로스 발생',
          'RSI 과매수에서 하락',
          'MACD 하락 다이버전스',
          '볼린저 밴드 상단에서 거부',
          'CVD 하락 추세',
          '매도세 우위 확인',
        ],
        neutral: [
          '횡보 구간 확인',
          '이동평균선 평행 배열',
          'RSI 중립대 진입',
          'MACD 약한 모멘텀',
          '볼린저 밴드 스퀴즈 형성',
          'CVD 뚜렷한 방향성 부재',
          '매수/매도 균형 상태',
        ],
      },
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
당신은 암호화폐 투자 전문가입니다. 다음 지침에 따라 체계적인 분석을 JSON 형식으로 제공해주세요.

0) **가격 표기 주의**
- 금액을 표기할 때 단위를 정확히 기재하십시오.
- 예: 1억 5천 9백만원 = "159,000,000원" (절대 "159,000원" 등으로 잘못 기재하지 말 것)
- 백만 단위 이상일 경우에도 10^n 자리로 풀어서 쓰는 것을 원칙으로 합니다.
- 거래량은 원화가 아닌 개수로 계산하십시오.

1) **출력 스키마** (JSON 필드)
- "ticker": 문자열 (예: "BTC/KRW")
- "reason": 문자열 (최소 ${INFERENCE_VALIDATION.reason.minLength}자 이상, 최대 ${INFERENCE_VALIDATION.reason.maxLength}자 이하)
- "rate": 숫자 (범위: ${INFERENCE_VALIDATION.rate.min} ~ ${INFERENCE_VALIDATION.rate.max}, 음수=매도 신호, 양수=매수 신호, 0=홀드 신호)

2) **분석 구조**
- **가격 분석**: 현재 가격, 주요 지지/저항선, 추세 방향 분석
- **기술적 분석**: 다음 지표 중 현 시장에 가장 관련성 높은 ${INFERENCE_RULES.analysis.technical.minIndicators}개 이상 선택하고 자동 계산 결과 활용
  (${INFERENCE_RULES.analysis.technical.required.map((item) => item.name).join(', ')})
- **펀더멘털 분석**: 주요 뉴스, 개발 상황, 네트워크 지표 분석
- **시장 분석**: ${INFERENCE_RULES.analysis.market.required.map((item) => item.metric).join(', ')}
- **심리 분석**: ${INFERENCE_RULES.analysis.sentiment.required.map((item) => item.metric).join(', ')}
- **리스크 관리**: ${INFERENCE_RULES.strategy.riskManagement.required.map((item) => item.metric).join(', ')}
- **최종 판단**: 종합적 견해와 권장 포지션(rate 값 근거 제시)

3) **rate 값의 의미 및 거래 규칙**
- **rate 값 정의** (목표 보유 비중):
  - rate < 0: **전량 매도** (음수가 되는 순간 보유 코인 100% 매도)
  - rate = 0: **보유 안함** (해당 코인을 포트폴리오에서 완전 제외)
  - rate = 0.1: **포트폴리오의 10%**를 해당 코인으로 보유
  - rate = 0.3: **포트폴리오의 30%**를 해당 코인으로 보유
  - rate = 0.5: **포트폴리오의 50%**를 해당 코인으로 보유
  - rate = 0.8: **포트폴리오의 80%**를 해당 코인으로 보유
  - rate = 1.0: **포트폴리오의 100%**를 해당 코인으로 보유 (최대 집중투자)

- **거래 빈도 제한 규칙** (반드시 준수):
  1. **매수 후 최소 홀딩 기간**: 매수 신호(rate > 0) 후 최소 7일간은 매도 금지
     - 예외: 급격한 하락(-10% 이상) 시에만 손절매 허용
  2. **매도 후 매수 금지 기간**: 매도 신호(rate < 0) 후 최소 3일간은 매수 금지
     - 급반등 시에도 성급한 재진입 방지
  3. **연속 거래 방지**: 동일한 방향 거래(매수→매수, 매도→매도)는 최소 2일 간격 유지
  4. **강한 확신이 있을 때만 거래**: 불확실할 때는 반드시 rate = 0 (홀드) 선택

- **거래 결정 우선순위**:
  1. 명확한 기술적/펀더멘털 신호가 있는 경우에만 거래
  2. 의심스러우면 홀드 (rate = 0)
  3. 트렌드 확인 후 거래 (단기 노이즈 무시)
  4. 리스크 관리 우선 (수익 기회 < 손실 방지)

- **수익 극대화 전략**:
  1. **시장 심리 활용**: 극도의 공포 시 매수, 극도의 탐욕 시 매도 고려
  2. **펀딩비율 역이용**: 높은 숏 펀딩비(음수) 시 매수 신호, 높은 롱 펀딩비(양수) 시 매도 신호
  3. **고래 지갑 추적**: 대량 이체 후 가격 변동성 증가 예상, 신중한 포지션 조정
  4. **거시경제 연동**: 금리 상승 시 리스크 자산 회피, VIX 급등 시 현금 보유 비중 증가
  5. **계절성 패턴**: 월말/분기말 기관 리밸런싱, 연말 세금 매도 등 고려
  6. **유동성 분석**: 거래량 급감 시 큰 포지션 변경 금지, 유동성 풍부할 때 진입/청산

4) **기술적 지표 자동 계산 방법**
- 다음 규칙에 따라 각 기술적 지표를 자동으로 계산하고 해석하세요:

  ** 이동평균선(MA) **
  - ${INFERENCE_RULES.analysis.technical.calculations.movingAverage.periods.join(', ')}일 이동평균선 계산
  - 골든크로스/데드크로스: ${INFERENCE_RULES.analysis.technical.calculations.movingAverage.crossoverSignificance * 100}% 이상 갭이 있을 때 유의미한 신호로 해석
  - 추세 확인: 최근 ${INFERENCE_RULES.analysis.technical.calculations.movingAverage.trendConfirmation}일간의 이동평균선 기울기로 추세 강도 판단

  ** MACD **
  - 파라미터: (${INFERENCE_RULES.analysis.technical.calculations.macd.fastPeriod}, ${INFERENCE_RULES.analysis.technical.calculations.macd.slowPeriod}, ${INFERENCE_RULES.analysis.technical.calculations.macd.signalPeriod})
  - 다이버전스: 차트와 MACD 라인 간 ${INFERENCE_RULES.analysis.technical.calculations.macd.divergenceThreshold * 100}% 이상 괴리 시 다이버전스로 해석

  ** RSI **
  - ${INFERENCE_RULES.analysis.technical.calculations.rsi.period}일 RSI 계산
  - 과매수: ${INFERENCE_RULES.analysis.technical.calculations.rsi.overbought} 이상
  - 과매도: ${INFERENCE_RULES.analysis.technical.calculations.rsi.oversold} 이하
  - 다이버전스 감지: ${INFERENCE_RULES.analysis.technical.calculations.rsi.divergenceDetection ? '활성화' : '비활성화'}

  ** 볼린저 밴드 **
  - ${INFERENCE_RULES.analysis.technical.calculations.bollingerBands.period}일 기준, ${INFERENCE_RULES.analysis.technical.calculations.bollingerBands.deviations}표준편차
  - 밴드폭 임계값: ${INFERENCE_RULES.analysis.technical.calculations.bollingerBands.bandwidthThreshold * 100}%
  - 스퀴즈 감지: ${INFERENCE_RULES.analysis.technical.calculations.bollingerBands.squeezeDetection ? '활성화' : '비활성화'}

  ** CVD (Cumulative Volume Delta) **
  - ${INFERENCE_RULES.analysis.technical.calculations.cumulativeVolumeDelta.period}일 분석 기간
  - 유의미한 거래량: 평균 대비 ${INFERENCE_RULES.analysis.technical.calculations.cumulativeVolumeDelta.volumeThreshold}배 이상

  ** 파이어 차트 (주문장 깊이) **
  - 주문장 깊이 레벨: ${INFERENCE_RULES.analysis.technical.calculations.orderBookDepth.depthLevels}단계
  - 저항선 임계값: 누적 매도 주문량이 평균 대비 ${INFERENCE_RULES.analysis.technical.calculations.orderBookDepth.resistanceThreshold}배
  - 지지선 임계값: 누적 매수 주문량이 평균 대비 ${INFERENCE_RULES.analysis.technical.calculations.orderBookDepth.supportThreshold}배

5) **지표 해석 가이드라인**
  ** 상승(매수) 신호 **
  ${INFERENCE_RULES.analysis.technical.interpretations.bullish.map((signal) => `- ${signal}`).join('\n  ')}

  ** 하락(매도) 신호 **
  ${INFERENCE_RULES.analysis.technical.interpretations.bearish.map((signal) => `- ${signal}`).join('\n  ')}

  ** 중립 신호 **
  ${INFERENCE_RULES.analysis.technical.interpretations.neutral.map((signal) => `- ${signal}`).join('\n  ')}

6) **추가 분석 필수 요소** (가능한 경우)
- **시장 미세구조**: 호가창 불균형, 대량 거래 패턴, 거래소간 가격 차이
- **온체인 지표**: 장기 보유자 비율 변화, 거래소 유출입, 실현손익비
- **센티먼트 지표**: 공포탐욕지수, 소셜미디어 언급량, 검색 트렌드
- **거시경제**: 미국 금리, 달러 인덱스, 주식시장 상관관계, VIX 지수
- **성과 검증**: 이전 추천 대비 실제 성과, 실패 패턴 학습 반영

7) **주의사항**
- 모든 분석은 구체적인 수치와 명확한 근거를 포함할 것
- 시장 상황에 가장 적합한 지표를 우선적으로 분석할 것
- 추상적 표현("상승세", "하락세" 등)만 사용하지 말고 항상 수치와 근거 함께 제시할 것
- 포트폴리오 다각화와 리스크 관리를 항상 고려할 것
- 단기 노이즈에 과도하게 반응하지 말고 중장기 추세에 집중할 것
- **수익률 목표**: 연 20-30% 수익률을 목표로 하되, 최대 손실 한도는 -15% 이내 유지
- **확률적 사고**: "100% 확실"은 없다는 전제 하에 항상 대안 시나리오 준비

8) **예시(JSON 구조) - (복붙 금지, 참조만)**
${JSON.stringify(INFERENCE_VALIDATION.responseExample, null, 2)}
`;
