import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import type {
  EasyInputMessage,
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  ResponseOutputText,
} from 'openai/resources/responses/responses';

import { ErrorService } from '../error/error.service';
import { NotifyService } from '../notify/notify.service';
import type { CitationRef } from './openai-citation.util';
import type { ResponseCreateConfig } from './openai.interface';

export interface ResponseOutputWithCitations {
  text: string;
  citations: CitationRef[];
}

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly notifyService: NotifyService,
  ) {}

  /**
   * Responses API 입력용 메시지 추가 (SDK: EasyInputMessage)
   */
  public addMessage(
    messages: EasyInputMessage[],
    role: 'user' | 'assistant' | 'system' | 'developer',
    content: string,
  ): void {
    messages.push({ role, content });
  }

  /**
   * 메시지 페어 추가 (i18n) — 프롬프트용 user 메시지 + 데이터용 user 메시지 두 개를 순서대로 추가.
   * instructions는 첫 번째 system 하나만 쓰고, 나머지는 모두 input 배열로 전달됨.
   */
  public addMessagePair(messages: EasyInputMessage[], promptKey: string, data: any, args?: any): void {
    const content = String(this.i18n.t(promptKey, args));
    const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    this.addMessage(messages, 'user', content);
    this.addMessage(messages, 'user', dataString);
  }

  public async getServerClient() {
    const client = new OpenAI({
      project: process.env.OPENAI_PROJECT,
      apiKey: process.env.OPENAI_SECRET_KEY,
      timeout: 3_600_000, // 1시간
      maxRetries: 3,
    });

    return client;
  }

  /**
   * Responses API 호출
   * - 사용 도구(tools)는 config에서만 지정한다. 첫 번째 system 메시지는 instructions, 나머지는 input으로 전달.
   */
  public async createResponse(messages: EasyInputMessage[], config: ResponseCreateConfig): Promise<Response> {
    const client = await this.getServerClient();

    const { instructions, input } = this.messagesToResponseInput(messages);

    const params: ResponseCreateParamsNonStreaming = {
      model: config.model as ResponseCreateParamsNonStreaming['model'],
      max_output_tokens: config.max_output_tokens,
      reasoning: config.reasoning_effort ? { effort: config.reasoning_effort } : undefined,
      service_tier: config.service_tier ?? undefined,
      instructions: instructions ?? undefined,
      input: input.length > 0 ? input : undefined,
      stream: false,
      tools: config.tools?.length ? config.tools : undefined,
      text: config.text
        ? {
            format: {
              type: 'json_schema',
              name: config.text.format.name,
              strict: config.text.format.strict,
              schema: config.text.format.schema as { [key: string]: unknown },
            },
          }
        : undefined,
    };

    this.logger.log(this.i18n.t('logging.openai.response.start'));

    const response = await client.responses.create(params);

    this.logger.log(this.i18n.t('logging.openai.response.complete'));

    return response;
  }

  /**
   * Responses API 응답에서 최종 출력 텍스트 추출.
   * output_text가 있으면 사용하고, 없거나 비어 있으면 output[].content[] (type === 'output_text')에서 추출.
   * 출력이 없으면 빈 문자열을 반환하므로, 호출부에서는 파싱 전에 비어 있지 않은지 검사해야 한다.
   */
  public getResponseOutput(response: Response): ResponseOutputWithCitations {
    const parsed = this.extractResponseBodyOutput(response as unknown as Record<string, unknown>);
    return parsed.text.length > 0 ? parsed : { text: '', citations: [] };
  }

  /**
   * Responses API 응답에서 최종 출력 텍스트만 추출 (레거시 호환).
   */
  public getResponseOutputText(response: Response): string {
    return this.getResponseOutput(response).text;
  }

  /**
   * instructions는 단일 문자열만 허용되므로, 첫 번째 system 메시지만 instructions로 쓴다.
   * 나머지(두 번째 system 포함, 모든 user 페어)는 input 배열에 순서대로 유지한다.
   */
  private messagesToResponseInput(messages: EasyInputMessage[]): {
    instructions: string | null;
    input: ResponseInput;
  } {
    const first = messages[0];
    if (first && first.role === 'system' && typeof first.content === 'string') {
      return {
        instructions: first.content,
        input: messages.slice(1) as ResponseInput,
      };
    }
    return { instructions: null, input: messages as ResponseInput };
  }

  /**
   * 배치 요청 생성 (Responses API, tools는 config에서 지정)
   */
  public createBatchRequest(customId: string, messages: EasyInputMessage[], config: ResponseCreateConfig): string {
    const { instructions, input } = this.messagesToResponseInput(messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_output_tokens: config.max_output_tokens,
      reasoning: config.reasoning_effort ? { effort: config.reasoning_effort } : undefined,
      service_tier: config.service_tier,
      instructions: instructions ?? undefined,
      input: input.length > 0 ? input : undefined,
      stream: false,
      tools: config.tools?.length ? config.tools : undefined,
    };

    if (config.text) {
      body.text = {
        format: {
          type: 'json_schema',
          name: config.text.format.name,
          strict: config.text.format.strict,
          schema: config.text.format.schema,
        },
      };
    }

    const request = {
      custom_id: customId,
      method: 'POST',
      url: '/v1/responses',
      body,
    };

    return JSON.stringify(request);
  }

  /**
   * 배치 요청 파일 업로드
   */
  public async createBatch(batchRequests: string): Promise<string> {
    const client = await this.getServerClient();

    this.logger.log(this.i18n.t('logging.openai.batch.upload_start'));

    // 배치 요청 파일 업로드
    const file = await client.files.create({
      file: new File([batchRequests], 'batch_requests.jsonl', { type: 'application/jsonl' }),
      purpose: 'batch',
    });

    this.logger.log(this.i18n.t('logging.openai.batch.upload_complete', { args: { fileId: file.id } }));

    // 배치 작업 생성 (Responses API)
    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/responses',
      completion_window: '24h',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.log(this.i18n.t('logging.openai.batch.job_created', { args: { batchId: batch.id } }));
    return batch.id;
  }

  /**
   * 배치 작업 완료 대기 및 결과 처리
   * @param batchId 대기할 배치 작업 ID
   * @param maxWaitTime 최대 대기 시간(밀리초, 기본값: 86400000ms = 24시간)
   * @param pollInterval 상태 확인 간격(밀리초, 기본값: 30000ms = 30초)
   * @returns 배치 작업 결과 배열
   */
  public async waitBatch(
    batchId: string,
    maxWaitTime: number = 86400000,
    pollInterval: number = 30000,
  ): Promise<any[]> {
    const client = await this.getServerClient();
    const startTime = Date.now();

    this.logger.log(this.i18n.t('logging.openai.batch.waiting', { args: { batchId } }));

    // 최대 대기 시간까지 배치 작업이 완료될 때까지 대기
    while (Date.now() - startTime < maxWaitTime) {
      const batch = await client.batches.retrieve(batchId);

      this.logger.log(this.i18n.t('logging.openai.batch.status', { args: { status: batch.status } }));

      // 배치 작업이 완료된 경우
      if (batch.status === 'completed') {
        this.logger.log(this.i18n.t('logging.openai.batch.completed'));

        if (batch.output_file_id) {
          // 배치 작업에 성공한 경우
          this.logger.log(this.i18n.t('logging.openai.batch.downloading'));
          return await this.downloadBatchResult(batch.output_file_id);
        } else if (batch.error_file_id) {
          // 배치 작업에 실패한 경우
          this.logger.error(this.i18n.t('logging.openai.batch.has_errors'));
          const errors = await this.downloadBatchResult(batch.error_file_id);
          this.logger.error({
            message: this.i18n.t('logging.openai.batch.error_details'),
            errors,
          });
          throw new Error(this.i18n.t('logging.openai.batch.failed_with_errors'));
        } else {
          // 두 ID가 모두 없는 예외적인 경우
          throw new Error(this.i18n.t('logging.openai.batch.no_files'));
        }
      } else if (['failed', 'cancelled', 'expired'].includes(batch.status)) {
        // 배치 작업에 실패한 경우
        throw new Error(this.i18n.t('logging.openai.batch.failed', { args: { batchId, status: batch.status } }));
      }

      // 대기
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // 최대 대기 시간 초과 시 배치 취소
    try {
      this.logger.warn(this.i18n.t('logging.openai.batch.timeout_cancelling', { args: { batchId } }));
      await client.batches.cancel(batchId);
      this.logger.log(this.i18n.t('logging.openai.batch.cancelled', { args: { batchId } }));
    } catch (cancelError) {
      this.logger.error(this.i18n.t('logging.openai.batch.cancel_failed', { args: { batchId } }), cancelError);
    }

    await this.notifyService.notifyServer(this.i18n.t('logging.openai.batch.timeout', { args: { batchId } }));

    throw new Error(this.i18n.t('logging.openai.batch.timeout', { args: { batchId } }));
  }

  /**
   * 배치 결과 파일 다운로드 및 파싱
   */
  public async downloadBatchResult(outputFileId: string | null | undefined): Promise<any[]> {
    if (!outputFileId) {
      this.logger.warn(this.i18n.t('logging.openai.batch.no_output_file'));
      return [];
    }

    const client = await this.getServerClient();

    const fileResponse = await client.files.content(outputFileId);
    const resultsText = await fileResponse.text();
    const lines = resultsText.trim().split('\n');
    const results: any[] = [];

    this.logger.debug(resultsText);

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const result = JSON.parse(line);

        if (result.error) {
          // 오류가 발생했을 떄
          this.logger.warn(
            this.i18n.t('logging.openai.batch.request_failed', {
              args: { customId: result.custom_id, error: result.error.message },
            }),
          );
          results.push({ custom_id: result.custom_id, error: result.error.message });
        } else {
          const parsed = this.extractResponseBodyOutput(result.response?.body);
          if (!parsed.text) {
            results.push({ custom_id: result.custom_id, error: 'No output_text in response' });
            continue;
          }

          const content = JSON.parse(parsed.text);
          results.push({
            custom_id: result.custom_id,
            data: content,
            citations: parsed.citations.length > 0 ? parsed.citations : undefined,
          });
        }
      } catch (error) {
        this.logger.error(this.i18n.t('logging.openai.batch.parse_error'), this.errorService.getErrorMessage(error));
        results.push({ error: 'Failed to parse result line', line });
      }
    }

    this.logger.log(this.i18n.t('logging.openai.batch.results_processed', { args: { count: results.length } }));
    return results;
  }

  private extractResponseBodyOutput(body: unknown): ResponseOutputWithCitations {
    const responseBody = (body ?? {}) as {
      output_text?: unknown;
      output?: unknown;
    };

    const outputItems = Array.isArray(responseBody.output) ? responseBody.output : [];
    const outputTexts: string[] = [];
    const citations: CitationRef[] = [];

    for (const item of outputItems) {
      const message = item as {
        type?: string;
        content?: unknown;
      };
      if (message.type !== 'message' || !Array.isArray(message.content)) {
        continue;
      }

      for (const content of message.content) {
        const outputText = content as ResponseOutputText & {
          annotations?: unknown;
        };

        if (outputText.type !== 'output_text' || typeof outputText.text !== 'string') {
          continue;
        }

        outputTexts.push(outputText.text);

        if (Array.isArray(outputText.annotations)) {
          citations.push(...this.normalizeCitations(outputText.annotations));
        }
      }
    }

    const textFromOutput = outputTexts.join('');
    if (textFromOutput.length > 0) {
      return { text: textFromOutput, citations };
    }

    if (typeof responseBody.output_text === 'string' && responseBody.output_text.length > 0) {
      return { text: responseBody.output_text, citations: [] };
    }

    return { text: '', citations: [] };
  }

  private normalizeCitations(annotations: unknown[]): CitationRef[] {
    return annotations
      .map((annotation) => {
        const data = annotation as {
          type?: unknown;
          text?: unknown;
          start_index?: unknown;
          end_index?: unknown;
          startIndex?: unknown;
          endIndex?: unknown;
          url?: unknown;
          title?: unknown;
          url_citation?: {
            url?: unknown;
            title?: unknown;
          };
        };

        const startIndexRaw = data.start_index ?? data.startIndex;
        const endIndexRaw = data.end_index ?? data.endIndex;
        const startIndex = typeof startIndexRaw === 'number' && Number.isFinite(startIndexRaw) ? startIndexRaw : null;
        const endIndex = typeof endIndexRaw === 'number' && Number.isFinite(endIndexRaw) ? endIndexRaw : null;

        return {
          type: typeof data.type === 'string' ? data.type : null,
          text: typeof data.text === 'string' ? data.text : null,
          startIndex,
          endIndex,
          url:
            typeof data.url_citation?.url === 'string'
              ? data.url_citation.url
              : typeof data.url === 'string'
                ? data.url
                : null,
          title:
            typeof data.url_citation?.title === 'string'
              ? data.url_citation.title
              : typeof data.title === 'string'
                ? data.title
                : null,
        } as CitationRef;
      })
      .filter((citation) => citation.startIndex != null || citation.endIndex != null || citation.url != null);
  }
}
