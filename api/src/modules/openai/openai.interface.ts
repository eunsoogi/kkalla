/**
 * Responses API 전용 타입 (Chat Completions 레거시 미사용)
 * 입력 메시지는 OpenAI SDK 타입 사용: EasyInputMessage, ResponseInput (openai/resources/responses)
 */

/** Responses API에서 사용할 도구 (설정으로 지정) */
export type ResponseTool = { type: 'web_search' };

/** Responses API 호출 설정 */
export interface ResponseCreateConfig {
  model: string;
  max_output_tokens: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  service_tier?: 'auto' | 'default' | 'flex' | 'scale' | 'priority';
  /** 사용할 도구 목록 (예: web_search). 설정에서 지정한다. */
  tools?: ResponseTool[];
  /** Structured output 시 text.format 사용 */
  text?: {
    format: {
      type: 'json_schema';
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  /** 앱 레벨 메시지/프롬프트 옵션 (API 파라미터 아님) */
  message?: {
    news?: number;
    recent?: number;
    recentDateLimit?: number;
  };
}
