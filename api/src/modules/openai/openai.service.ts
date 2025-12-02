import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ChatCompletionCreateParams, ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import { ErrorService } from '../error/error.service';
import { NotifyService } from '../notify/notify.service';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly notifyService: NotifyService,
  ) {}

  /**
   * OpenAI 메시지 추가 헬퍼
   *
   * - ChatCompletionMessageParam 배열에 메시지를 추가합니다.
   *
   * @param messages 메시지 배열
   * @param role 메시지 역할 (system, assistant, user)
   * @param content 메시지 내용
   */
  public addMessage(
    messages: ChatCompletionMessageParam[],
    role: 'system' | 'assistant' | 'user',
    content: string,
  ): void {
    messages.push({ role, content });
  }

  /**
   * OpenAI 메시지 페어 추가 헬퍼 (i18n 지원)
   *
   * - i18n 키로 변환된 프롬프트와 데이터를 함께 추가합니다.
   * - 프롬프트와 데이터를 각각 별도의 user 메시지로 추가합니다.
   *
   * @param messages 메시지 배열
   * @param promptKey i18n 키
   * @param data 데이터 객체 (JSON으로 변환됨)
   * @param args i18n 인자 (선택적)
   */
  public addMessagePair(messages: ChatCompletionMessageParam[], promptKey: string, data: any, args?: any): void {
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
   * 실시간 채팅 완성 API 호출
   */
  public async createChatCompletion(
    messages: ChatCompletionMessageParam[],
    config: Omit<ChatCompletionCreateParams, 'messages'>,
  ) {
    const client = await this.getServerClient();

    const params: ChatCompletionCreateParams = {
      model: config.model,
      max_completion_tokens: config.max_completion_tokens,
      reasoning_effort: config.reasoning_effort,
      verbosity: config.verbosity,
      service_tier: config.service_tier,
      response_format: config.response_format,
      messages,
      stream: false,
    };

    this.logger.log(this.i18n.t('logging.openai.chat.completion_start'));

    const completion = await client.chat.completions.create(params);

    this.logger.log(this.i18n.t('logging.openai.chat.completion_complete'));

    return completion;
  }

  /**
   * 배치 요청 생성
   */
  public createBatchRequest(
    customId: string,
    messages: ChatCompletionMessageParam[],
    config: Omit<ChatCompletionCreateParams, 'messages'>,
  ): string {
    const request = {
      custom_id: customId,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: config.model,
        max_completion_tokens: config.max_completion_tokens,
        reasoning_effort: config.reasoning_effort,
        verbosity: config.verbosity,
        service_tier: config.service_tier,
        response_format: config.response_format,
        messages,
        stream: false,
      },
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

    // 배치 작업 생성
    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
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
        } else if (result.response?.body?.choices?.[0]?.message?.content) {
          // 메시지가 있을 때
          const content = JSON.parse(result.response.body.choices[0].message.content);
          results.push({ custom_id: result.custom_id, data: content });
        } else {
          // 메시지가 없을 때
          results.push({ custom_id: result.custom_id, error: 'No content in response' });
        }
      } catch (error) {
        this.logger.error(this.i18n.t('logging.openai.batch.parse_error'), this.errorService.getErrorMessage(error));
        results.push({ error: 'Failed to parse result line', line });
      }
    }

    this.logger.log(this.i18n.t('logging.openai.batch.results_processed', { args: { count: results.length } }));
    return results;
  }
}
