import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ChatCompletionCreateParams, ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import { ErrorService } from '../error/error.service';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
  ) {}

  public async getServerClient() {
    const client = new OpenAI({
      project: process.env.OPENAI_PROJECT,
      apiKey: process.env.OPENAI_SECRET_KEY,
    });

    return client;
  }

  /**
   * 전체 마켓 분석용 Batch 요청 생성
   */
  /**
   * 범용 Batch 요청 생성
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

  public async createBatchJob(batchRequests: string): Promise<string> {
    const client = await this.getServerClient();

    this.logger.log(this.i18n.t('logging.openai.batch.upload_start'));

    // 1. 배치 요청 파일 업로드
    const file = await client.files.create({
      file: new File([batchRequests], 'batch_requests.jsonl', { type: 'application/jsonl' }),
      purpose: 'batch',
    });

    this.logger.log(this.i18n.t('logging.openai.batch.upload_complete', { args: { fileId: file.id } }));

    // 2. 배치 작업 생성
    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        description: 'KRW 마켓 종목 분석 배치',
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.log(this.i18n.t('logging.openai.batch.job_created', { args: { batchId: batch.id } }));
    return batch.id;
  }

  /**
   * Batch 작업 완료 대기 및 결과 처리
   */
  public async waitForBatchCompletion(batchId: string): Promise<any[]> {
    const client = await this.getServerClient();
    const maxWaitTime = 3600000; // 1시간 최대 대기
    const pollInterval = 30000; // 30초마다 상태 확인
    const startTime = Date.now();

    this.logger.log(this.i18n.t('logging.openai.batch.waiting', { args: { batchId } }));

    while (Date.now() - startTime < maxWaitTime) {
      const batch = await client.batches.retrieve(batchId);

      this.logger.log(this.i18n.t('logging.openai.batch.status', { args: { status: batch.status } }));

      if (batch.status === 'completed') {
        this.logger.log(this.i18n.t('logging.openai.batch.completed'));

        if (batch.output_file_id) {
          this.logger.log(this.i18n.t('logging.openai.batch.downloading'));
          return await this.downloadAndParseBatchResults(batch.output_file_id);
        } else if (batch.error_file_id) {
          this.logger.error(this.i18n.t('logging.openai.batch.has_errors'));
          const errors = await this.downloadAndParseBatchResults(batch.error_file_id);
          this.logger.error({
            message: this.i18n.t('logging.openai.batch.error_details'),
            errors,
          });
          throw new Error(this.i18n.t('logging.openai.batch.failed_with_errors'));
        } else {
          // 두 ID가 모두 없는 예외적인 경우
          throw new Error(this.i18n.t('logging.openai.batch.no_files'));
        }
      } else if (batch.status === 'failed' || batch.status === 'cancelled') {
        throw new Error(this.i18n.t('logging.openai.batch.failed', { args: { status: batch.status } }));
      }

      // 대기
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(this.i18n.t('logging.openai.batch.timeout'));
  }

  /**
   * Batch 결과 파일 다운로드 및 파싱
   */
  public async downloadAndParseBatchResults(outputFileId: string | null | undefined): Promise<any[]> {
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
          this.logger.warn(
            this.i18n.t('logging.openai.batch.request_failed', {
              args: { customId: result.custom_id, error: result.error.message },
            }),
          );
          // 실패한 요청에 대해서는 null 또는 에러 객체를 결과에 추가할 수 있습니다.
          results.push({ custom_id: result.custom_id, error: result.error.message });
        } else if (result.response?.body?.choices?.[0]?.message?.content) {
          const content = JSON.parse(result.response.body.choices[0].message.content);
          results.push({ custom_id: result.custom_id, data: content });
        } else {
          results.push({ custom_id: result.custom_id, error: 'No content in response' });
        }
      } catch (error) {
        this.logger.error(this.i18n.t('logging.openai.batch.parse_error'), this.errorService.getErrorMessage(error));
        // 파싱 에러가 발생한 라인을 식별할 수 있도록 정보를 추가합니다.
        results.push({ error: 'Failed to parse result line', line });
      }
    }

    this.logger.log(this.i18n.t('logging.openai.batch.results_processed', { args: { count: results.length } }));
    return results;
  }
}
