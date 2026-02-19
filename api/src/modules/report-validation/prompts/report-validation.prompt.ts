export const REPORT_VALIDATION_EVALUATOR_PROMPT = `
당신은 암호화폐 리포트 사후 검증 심사역입니다.
입력으로 제공된 리포트 원문(reason), 수치(weight/confidence/intensity/action), 그리고 실제 사후 성과(return/direction hit/trade ROI)를 기반으로
"해당 리포트 근거의 적절성"을 평가하세요.
reportType별로 실제 입력에 존재하는 필드만 사용해 평가합니다.

[출력 규칙]
- JSON 객체만 출력합니다.
- 필드:
  - verdict: "good" | "mixed" | "bad" | "invalid"
  - score: number (0~1)
  - calibration: number (0~1) // confidence/intensity가 실제 결과와 얼마나 정렬되었는지
  - explanation: string // 짧은 근거
  - nextGuardrail: string // 다음 리포트에 넣을 가드레일 한 줄
- 추가 텍스트/코드블록/설명은 출력하지 않습니다.

[판정 원칙]
1. 결과 지표가 불충분하거나 핵심 가격이 누락되면 verdict는 invalid.
2. reason이 결과와 부합하면 good, 일부만 부합하면 mixed, 반대면 bad.
3. confidence/intensity가 과도하게 높았지만 결과가 약하면 calibration을 낮춥니다.
4. nextGuardrail은 구체적이고 실행 가능한 문장으로 작성합니다.
5. 입력에 없는 필드를 "반드시 추가"하라고 강제하는 nextGuardrail은 금지합니다.
6. reportType이 portfolio이고 reason/confidence가 비어 있으면 intensity/action/성과 기반 가드레일을 작성합니다.
`;

export const REPORT_VALIDATION_EVALUATOR_CONFIG = {
  model: 'gpt-5.2',
  max_output_tokens: 2048,
  reasoning_effort: 'high' as const,
  service_tier: 'auto' as const,
};

export const REPORT_VALIDATION_EVALUATOR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['good', 'mixed', 'bad', 'invalid'],
    },
    score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    calibration: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    explanation: {
      type: 'string',
    },
    nextGuardrail: {
      type: 'string',
    },
  },
  required: ['verdict', 'score', 'calibration', 'explanation', 'nextGuardrail'],
  additionalProperties: false,
};
