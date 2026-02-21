import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import type { EasyInputMessage } from 'openai/resources/responses/responses';

import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { CompactFeargreed } from '@/modules/feargreed/feargreed.interface';
import { FeargreedService } from '@/modules/feargreed/feargreed.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';
import { NewsTypes } from '@/modules/news/news.enum';
import { CompactNews } from '@/modules/news/news.interface';
import { NewsService } from '@/modules/news/news.service';
import { toUserFacingText } from '@/modules/openai/openai-citation.util';
import { OpenaiService } from '@/modules/openai/openai.service';
import { formatNumber } from '@/utils/number';
import { normalizeKrwSymbol } from '@/utils/symbol';

import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { HistoryService } from '../history/history.service';
import { MarketRecommendation } from '../market-research/entities/market-recommendation.entity';
import {
  MARKET_RECOMMENDATION_STATE_CACHE_KEY,
  MARKET_RECOMMENDATION_STATE_MAX_AGE_MS,
  MarketRecommendationState,
} from '../market-research/market-research.interface';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { ReportValidationService } from '../report-validation/report-validation.service';
import { ScheduleService } from '../schedule/schedule.service';
import { Trade } from '../trade/entities/trade.entity';
import { TradeData, TradeRequest } from '../trade/trade.interface';
import { UPBIT_MINIMUM_TRADE_PRICE } from '../upbit/upbit.constant';
import { MarketFeatures } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { BalanceRecommendationDto } from './dto/balance-recommendation.dto';
import { GetBalanceRecommendationsCursorDto } from './dto/get-balance-recommendations-cursor.dto';
import { GetBalanceRecommendationsPaginationDto } from './dto/get-balance-recommendations-pagination.dto';
import { BalanceRecommendation } from './entities/balance-recommendation.entity';
import {
  UPBIT_BALANCE_RECOMMENDATION_CONFIG,
  UPBIT_BALANCE_RECOMMENDATION_PROMPT,
  UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/balance-recommendation.prompt';
import { ScheduleExpression } from './rebalance.enum';
import { BalanceRecommendationAction, BalanceRecommendationData, RecommendationItem } from './rebalance.interface';

/**
 * 리밸런싱 모듈의 핵심 서비스.
 *
 * - 기존 보유 종목 및 새로운 추천 종목을 대상으로 잔고 추천을 수행한다.
 * - 스케줄 활성화된 사용자들에 대해 실제 거래를 실행한다.
 * - SQS를 통해 비동기로 거래를 처리한다.
 */
@Injectable()
export class RebalanceService implements OnModuleInit {
  private readonly logger = new Logger(RebalanceService.name);

  private readonly MINIMUM_TRADE_INTENSITY = 0;
  private readonly AI_SIGNAL_WEIGHT = 0.7;
  private readonly FEATURE_SIGNAL_WEIGHT = 0.3;
  private readonly FEATURE_CONFIDENCE_WEIGHT = 0.3;
  private readonly FEATURE_MOMENTUM_WEIGHT = 0.25;
  private readonly FEATURE_LIQUIDITY_WEIGHT = 0.2;
  private readonly FEATURE_VOLATILITY_WEIGHT = 0.15;
  private readonly FEATURE_STABILITY_WEIGHT = 0.1;
  private readonly VOLATILITY_REFERENCE = 0.12;
  private readonly SELL_SCORE_THRESHOLD = 0.6;
  private readonly MIN_REBALANCE_BAND = 0.01;
  private readonly REBALANCE_BAND_RATIO = 0.1;
  private readonly ESTIMATED_FEE_RATE = 0.0005;
  private readonly ESTIMATED_SLIPPAGE_RATE = 0.001;
  private readonly COST_GUARD_MULTIPLIER = 2;
  private readonly MIN_RECOMMEND_WEIGHT = 0.05;
  private readonly MIN_RECOMMEND_CONFIDENCE = 0.45;
  private readonly COIN_MAJOR_ITEM_COUNT = 2;
  private readonly COIN_MINOR_ITEM_COUNT = 5;
  private readonly NASDAQ_ITEM_COUNT = 0;
  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;

  // Amazon SQS
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  private readonly queueUrl = process.env.AWS_SQS_QUEUE_URL_REBALANCE;

  constructor(
    private readonly i18n: I18nService,
    private readonly blacklistService: BlacklistService,
    private readonly historyService: HistoryService,
    private readonly upbitService: UpbitService,
    private readonly cacheService: CacheService,
    private readonly scheduleService: ScheduleService,
    private readonly categoryService: CategoryService,
    private readonly notifyService: NotifyService,
    private readonly profitService: ProfitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
    private readonly openaiService: OpenaiService,
    private readonly featureService: FeatureService,
    private readonly errorService: ErrorService,
    private readonly reportValidationService: ReportValidationService,
  ) {
    if (!this.queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL_REBALANCE environment variable is required');
    }
  }

  /**
   * 모듈 초기화 시 SQS Consumer 시작
   */
  async onModuleInit() {
    this.startConsumer();
  }

  /**
   * SQS Consumer 시작
   *
   * - 리밸런싱 전용 SQS 큐에서 메시지를 소비하기 시작합니다.
   * - 오류 발생 시 5초 후 자동으로 재시작합니다.
   */
  private async startConsumer(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    try {
      // 메시지 소비 루프 시작
      await this.consumeMessage();
    } catch (error) {
      // 오류 발생 시 로그 기록
      this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      this.logger.log(this.i18n.t('logging.sqs.consumer.restart'));

      // 5초 후 자동 재시작 (무한 루프 방지를 위한 지연)
      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  /**
   * SQS 메시지 소비 루프
   *
   * - 리밸런싱 전용 큐에서 메시지를 지속적으로 폴링합니다.
   * - 최대 10개의 메시지를 한 번에 받아 병렬로 처리합니다.
   * - 메시지가 없으면 20초 대기 후 다시 폴링합니다.
   */
  private async consumeMessage(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    // 무한 루프로 지속적으로 메시지 폴링
    while (true) {
      try {
        // SQS에서 최대 10개의 메시지를 한 번에 받아옴 (20초 대기)
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );

        // 메시지가 없으면 다음 루프로 진행
        if (!result.Messages?.length) continue;

        this.logger.log(
          this.i18n.t('logging.sqs.consumer.processing', {
            args: { count: result.Messages.length },
          }),
        );

        // 받아온 모든 메시지를 병렬로 처리
        await Promise.all(result.Messages.map((message) => this.handleMessage(message)));
      } catch (error) {
        // 오류 발생 시 로그만 기록하고 루프 계속 진행 (안정성)
        this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      }
    }
  }

  /**
   * 개별 SQS 메시지 처리
   *
   * - 리밸런싱 전용 큐의 메시지를 처리합니다.
   * - 사용자별 리밸런싱 거래를 실행하고 수익금 알림을 전송합니다.
   * - 처리 완료 후 메시지를 큐에서 삭제합니다.
   *
   * @param message SQS 메시지
   */
  private async handleMessage(message: Message): Promise<void> {
    const messageId = message.MessageId;
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));

    try {
      // 메시지 본문 파싱: 사용자 정보, 추론 결과, 매수 가능 여부 추출
      const messageBody = JSON.parse(message.Body);
      const { user, inferences, buyAvailable } = messageBody;

      // Rebalance 전용 큐이므로 모든 메시지를 처리
      // 사용자별 리밸런싱 거래 실행
      const trades = await this.executeRebalanceForUser(user, inferences, buyAvailable ?? true);

      this.logger.debug(trades);

      // 실행된 거래가 있을 때만 수익금 알림 전송
      if (trades.length > 0) {
        const profitData = await this.profitService.getProfit(user);

        await this.notifyService.notify(
          user,
          this.i18n.t('notify.profit.result', {
            args: {
              profit: formatNumber(profitData.profit),
            },
          }),
        );
      }

      this.logger.log(this.i18n.t('logging.sqs.message.complete', { args: { id: messageId } }));

      // 처리 완료된 메시지를 큐에서 삭제 (중복 처리 방지)
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger.log(this.i18n.t('logging.sqs.message.delete', { args: { id: messageId } }));
    } catch (error) {
      // 오류 발생 시 로그 기록 후 예외 재발생 (메시지가 다시 큐로 돌아가도록)
      this.logger.error(
        this.i18n.t('logging.sqs.message.error', {
          args: { id: messageId, error },
        }),
      );
      throw error;
    }
  }

  /**
   * 새로운 종목 포함 리밸런싱 스케줄
   *
   * - 매일 오전 6시 35분에 실행됩니다.
   * - 기존 보유 종목 + 메이저 코인 + 시장 추천 종목을 대상으로 리밸런싱을 수행합니다.
   * - 전체 포트폴리오를 재조정하여 새로운 투자 기회를 포착합니다.
   */
  @Cron(ScheduleExpression.DAILY_BALANCE_RECOMMENDATION_NEW)
  @WithRedlock({ duration: 3_600_000 }) // 1시간 동안 실행
  public async executeBalanceRecommendationNew(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeBalanceRecommendationNewTask();
  }

  public async executeBalanceRecommendationNewTask(): Promise<void> {
    this.logger.log(this.i18n.t('logging.schedule.start'));

    // 스케줄 활성화된 사용자 목록 조회
    const users = await this.scheduleService.getUsers();

    // 기존 보유 항목 재추론: 히스토리에 저장된 종목들
    const historyItems = await this.historyService.fetchHistory();

    // 새로운 종목 추가: 메이저 코인(BTC/ETH) 및 시장 추천 종목
    const majorCoinItems = await this.fetchMajorCoinItems();
    const recommendItems = await this.fetchRecommendItems();

    // 우선 순위를 반영해 추론 종목 목록 정리
    // 순서: 기존 보유 > 메이저 코인 > 시장 추천 (앞에 있는 것이 우선순위 높음)
    const allItems = [...historyItems, ...majorCoinItems, ...recommendItems];
    // 중복 제거 및 블랙리스트 필터링
    const items = await this.filterBalanceRecommendations(allItems);

    // 추론 실행 → SQS 메시지 전송 → 히스토리 저장
    await this.scheduleRebalance(users, items, true);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  /**
   * 기존 보유 종목만 리밸런싱 스케줄
   *
   * - 매일 0, 4, 8, 12, 16, 20시 35분에 실행됩니다 (4시간 간격).
   * - 기존 보유 종목만 대상으로 리밸런싱을 수행합니다.
   * - 포트폴리오 비율을 재조정하여 최적의 배분을 유지합니다.
   */
  @Cron(ScheduleExpression.DAILY_BALANCE_RECOMMENDATION_EXISTING)
  @WithRedlock({ duration: 3_600_000 }) // 1시간 동안 실행
  public async executeBalanceRecommendationExisting(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeBalanceRecommendationExistingTask();
  }

  public async executeBalanceRecommendationExistingTask(): Promise<void> {
    this.logger.log(this.i18n.t('logging.schedule.start'));

    // 스케줄 활성화된 사용자 목록 조회
    const users = await this.scheduleService.getUsers();

    // 기존 보유 항목만 재추론: 히스토리에 저장된 종목들만 대상
    const historyItems = await this.historyService.fetchHistory();

    // 중복 제거 및 블랙리스트 필터링
    const items = await this.filterBalanceRecommendations(historyItems);

    // 추론 실행 → SQS 메시지 전송 → 히스토리 저장
    await this.scheduleRebalance(users, items, true);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  /**
   * 리밸런싱 스케줄 실행: 추론 실행 + SQS 메시지 전송 + 히스토리 저장
   *
   * - 주기적으로 실행되는 리밸런싱 작업의 전체 프로세스를 처리합니다.
   * - 추론 실행 → SQS 메시지 전송 → 히스토리 저장 순서로 진행됩니다.
   * - SQS를 통해 비동기로 사용자별 거래를 처리하여 동시성 문제를 방지합니다.
   *
   * @param users 스케줄 활성화된 사용자 목록
   * @param items 추론 대상 종목 목록 (기존 보유 종목 + 새로운 추천 종목)
   * @param buyAvailable 매수 가능 여부 (false인 경우 매도만 수행)
   */
  public async scheduleRebalance(
    users: User[],
    items: RecommendationItem[],
    buyAvailable: boolean = true,
  ): Promise<void> {
    // 1. 추론 실행: 종목별 잔고 추천 비율 계산
    const inferences = await this.balanceRecommendation(items);

    // 2. SQS 메시지 전송: 각 사용자별로 리밸런싱 작업을 큐에 등록
    await this.publishRebalanceMessage(users, inferences, buyAvailable);

    // 3. 현재 포트폴리오 저장: 편입된 종목들을 히스토리에 저장
    await this.historyService.saveHistory(
      this.filterIncludedBalanceRecommendations(inferences).map((inference, index) => ({
        ...inference,
        index,
      })),
    );

    // 4. 클라이언트 초기화: Upbit 및 Notify 클라이언트 캐시 초기화
    this.clearClients();
  }

  /**
   * 리밸런싱 SQS 메시지 전송
   *
   * - 리밸런싱 전용 SQS 큐에 사용자별 거래 작업 메시지를 전송합니다.
   * - 각 사용자마다 별도의 메시지를 생성하여 병렬로 전송합니다.
   * - 메시지는 비동기로 처리되어 동시성 문제를 방지합니다.
   *
   * @param users 스케줄 활성화된 사용자 목록
   * @param inferences 추론 결과 (종목별 잔고 추천 비율)
   * @param buyAvailable 매수 가능 여부
   */
  private async publishRebalanceMessage(
    users: User[],
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<void> {
    this.logger.log(
      this.i18n.t('logging.sqs.producer.start', {
        args: { count: users.length },
      }),
    );

    try {
      // 각 사용자별로 리밸런싱 메시지 생성
      // 메시지 본문에 사용자 정보, 추론 결과, 매수 가능 여부 포함
      const messages = users.map(
        (user) =>
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({ type: 'rebalance', user, inferences, buyAvailable }),
          }),
      );

      // 모든 메시지를 병렬로 전송 (성능 최적화)
      const results = await Promise.all(messages.map((message) => this.sqs.send(message)));
      this.logger.debug(results);
      this.logger.log(this.i18n.t('logging.sqs.producer.complete'));
    } catch (error) {
      // 오류 발생 시 로그 기록 후 예외 재발생
      this.logger.error(this.i18n.t('logging.sqs.producer.error', { args: { error } }));
      throw error;
    }
  }

  /**
   * 사용자별 리밸런싱 거래 실행
   *
   * - SQS consumer에서 호출되는 메인 거래 실행 함수입니다.
   * - 전체 포트폴리오를 재조정합니다:
   *   1. 권한이 없는 종목 필터링
   *   2. 편입/편출 종목 결정
   *   3. 편출 처리 (기존 보유 종목 중 추론에 없는 종목 매도)
   *   4. 편입 처리 (추론된 종목 매수)
   * - 거래 완료 후 사용자에게 알림을 전송합니다.
   *
   * @param user 거래를 실행할 사용자
   * @param inferences 추론 결과 (종목별 잔고 추천 비율)
   * @param buyAvailable 매수 가능 여부 (false인 경우 매도만 수행)
   * @returns 실행된 거래 목록
   */
  public async executeRebalanceForUser(
    user: User,
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링: 사용자가 거래할 수 있는 카테고리만 포함
    const authorizedBalanceRecommendations = await this.filterUserAuthorizedBalanceRecommendations(user, inferences);

    // 권한이 있는 추론이 없으면 리포트/알림 없이 종료
    if (authorizedBalanceRecommendations.length === 0) {
      this.clearClients();
      return [];
    }

    // 추론 결과를 사용자에게 알림 전송 (종목별 추천 비율 표시)
    await this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          transactions: authorizedBalanceRecommendations
            .map((recommendation) =>
              this.i18n.t('notify.inference.transaction', {
                args: {
                  symbol: recommendation.symbol,
                  prevModelTargetWeight: this.toPercent(recommendation.prevModelTargetWeight),
                  modelTargetWeight: this.toPercent(recommendation.modelTargetWeight),
                  reason: toUserFacingText(recommendation.reason ?? '') || '-',
                },
              }),
            )
            .join('\n'),
        },
      }),
    );

    // 사용자별 최대 편입 종목 수 계산 (카테고리별 제한 고려)
    const count = await this.getItemCount(user);

    // 유저 계좌 조회: 현재 보유 종목 및 잔고 정보
    const balances = await this.upbitService.getBalances(user);

    // 계좌 정보가 없으면 거래 불가
    if (!balances) return [];

    const orderableSymbols = await this.buildOrderableSymbolSet([
      ...authorizedBalanceRecommendations.map((inference) => inference.symbol),
      ...balances.info.map((item) => `${item.currency}/${item.unit_currency}`),
    ]);
    // 거래 가능한 총 평가금액은 사용자당 1회만 계산해 모든 주문에서 재사용
    const marketPrice = await this.upbitService.calculateTradableMarketValue(balances, orderableSymbols);
    // 시장 상황에 따른 전체 익스포저 배율 (risk-on/risk-off)
    const regimeMultiplier = await this.getMarketRegimeMultiplier();
    // 현재가 기준 포트폴리오 비중 맵 (심볼 -> 현재 비중)
    const currentWeights = await this.buildCurrentWeightMap(balances, marketPrice, orderableSymbols);
    const tradableMarketValueMap = await this.buildTradableMarketValueMap(balances, orderableSymbols);

    // 편입/편출 결정 분리
    // 1. 추론에 없는 기존 보유 종목 매도 요청 (완전 매도)
    const nonBalanceRecommendationTradeRequests: TradeRequest[] = this.generateNonBalanceRecommendationTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
    );

    // 2. 편출 대상 종목 매도 요청 (추론에서 제외된 종목)
    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
    );

    // 3. 편입 대상 종목 매수/매도 요청 (목표 비율 조정)
    let includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
    );

    // 매수 불가능한 경우 매도만 수행 (diff < 0인 것만 필터링)
    if (!buyAvailable) {
      includedTradeRequests = includedTradeRequests.filter((item) => item.diff < 0);
    }

    // 편출 처리: 병렬로 모든 매도 주문 실행
    const nonBalanceRecommendationTrades: Trade[] = await Promise.all(
      nonBalanceRecommendationTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    const excludedTrades: Trade[] = await Promise.all(
      excludedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 편입 처리: 병렬로 모든 매수/매도 주문 실행
    const includedTrades: Trade[] = await Promise.all(
      includedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 실행된 거래 중 null 제거 (주문이 생성되지 않은 경우)
    const allTrades: Trade[] = [...nonBalanceRecommendationTrades, ...excludedTrades, ...includedTrades].filter(
      (item) => item !== null,
    );

    // 거래가 실행된 경우 사용자에게 알림 전송
    if (allTrades.length > 0) {
      await this.notifyService.notify(
        user,
        this.i18n.t('notify.order.result', {
          args: {
            transactions: allTrades
              .map((trade) =>
                this.i18n.t('notify.order.transaction', {
                  args: {
                    symbol: trade.symbol,
                    type: this.i18n.t(`label.order.type.${trade.type}`),
                    amount: formatNumber(trade.amount),
                    profit: formatNumber(trade.profit),
                  },
                }),
              )
              .join('\n'),
          },
        }),
      );
    }

    // 클라이언트 캐시 초기화 (메모리 누수 방지)
    this.clearClients();

    return allTrades;
  }

  /**
   * 사용자 권한 기반 추론 필터링
   *
   * - 사용자가 거래 권한이 있는 카테고리만 필터링합니다.
   * - 사용자가 활성화한 카테고리만 포함합니다.
   *
   * @param user 사용자
   * @param inferences 추론 결과 목록
   * @returns 권한이 있는 추론 결과만 필터링된 목록
   */
  private async filterUserAuthorizedBalanceRecommendations(
    user: User,
    inferences: BalanceRecommendationData[],
  ): Promise<BalanceRecommendationData[]> {
    // 사용자가 활성화한 카테고리 목록 조회
    const enabledCategories = await this.categoryService.findEnabledByUser(user);

    // 필터링 조건:
    // 1. 사용자가 해당 카테고리에 대한 거래 권한이 있어야 함
    // 2. 사용자가 해당 카테고리를 활성화했어야 함
    return inferences.filter(
      (item) =>
        this.categoryService.checkCategoryPermission(user, item.category) &&
        enabledCategories.some((uc) => uc.category === item.category),
    );
  }

  /**
   * 편입 대상 추론 필터링
   *
   * - 카테고리별로 그룹화하여 각 카테고리에서 편입할 종목을 선정합니다.
   * - intensity가 0보다 크고, 카테고리별 최대 종목 수 내에서 선정됩니다.
   *
   * @param inferences 전체 추론 결과
   * @returns 편입 대상 추론 결과 목록
   */
  private filterIncludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    // 카테고리별로 그룹화한 후 각 카테고리에서 편입 대상 선정
    const results = this.groupBalanceRecommendationsByCategory(inferences).map(
      ([category, categoryBalanceRecommendations]) =>
        this.getIncludedBalanceRecommendationsByCategory(categoryBalanceRecommendations, category as Category),
    );
    // 카테고리별 결과를 병합하고 다시 정렬 (우선순위 반영)
    return this.mergeSortedBalanceRecommendations(results);
  }

  /**
   * 편출 대상 추론 필터링
   *
   * - 편입 대상에 포함되지 않은 종목들을 편출 대상으로 선정합니다.
   * - 기존 보유 종목 중 추론에서 제외된 종목을 매도 대상으로 합니다.
   *
   * @param inferences 전체 추론 결과
   * @returns 편출 대상 추론 결과 목록
   */
  private filterExcludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    // 카테고리별로 그룹화한 후 각 카테고리에서 편출 대상 선정
    const results = this.groupBalanceRecommendationsByCategory(inferences).map(
      ([category, categoryBalanceRecommendations]) =>
        this.getExcludedBalanceRecommendationsByCategory(categoryBalanceRecommendations, category as Category),
    );
    // 카테고리별 결과를 병합하고 다시 정렬
    return this.mergeSortedBalanceRecommendations(results);
  }

  /**
   * 카테고리별 추론 그룹화
   *
   * - 추론 결과를 카테고리(COIN_MAJOR, COIN_MINOR, NASDAQ)별로 그룹화합니다.
   *
   * @param inferences 전체 추론 결과
   * @returns 카테고리별로 그룹화된 추론 결과 배열
   */
  private groupBalanceRecommendationsByCategory(
    inferences: BalanceRecommendationData[],
  ): Array<[string, BalanceRecommendationData[]]> {
    // 추론 결과를 카테고리별로 그룹화
    // reduce를 사용하여 카테고리 키로 분류
    return Object.entries(
      inferences.reduce(
        (acc, curr) => {
          // 카테고리 키가 없으면 빈 배열 생성
          if (!acc[curr.category]) {
            acc[curr.category] = [];
          }
          // 해당 카테고리 배열에 추가
          acc[curr.category].push(curr);
          return acc;
        },
        {} as Record<string, BalanceRecommendationData[]>,
      ),
    );
  }

  /**
   * 카테고리별 편입 대상 선정
   *
   * - 정렬된 추론 결과에서 modelTargetWeight > 0인 종목만 필터링합니다.
   * - 카테고리별 최대 종목 수만큼만 선정합니다.
   *
   * @param categoryBalanceRecommendations 카테고리별 추론 결과
   * @param category 카테고리
   * @returns 편입 대상 추론 결과
   */
  private getIncludedBalanceRecommendationsByCategory(
    categoryBalanceRecommendations: BalanceRecommendationData[],
    category: Category,
  ): BalanceRecommendationData[] {
    // 1. 정렬: 기존 보유 종목 우선, 그 다음 buyScore 내림차순
    // 2. 필터링: modelTargetWeight > 0인 종목만 (매수/비율 조정 대상)
    // 3. 제한: 카테고리별 최대 종목 수만큼만 선정
    return this.sortBalanceRecommendations(categoryBalanceRecommendations)
      .filter((item) => this.isIncludedRecommendation(item))
      .slice(0, this.getItemCountByCategory(category));
  }

  /**
   * 카테고리별 편출 대상 선정
   *
   * - 편입 대상에 포함되지 않은 종목들을 편출 대상으로 선정합니다.
   *
   * @param categoryBalanceRecommendations 카테고리별 추론 결과
   * @param category 카테고리
   * @returns 편출 대상 추론 결과
   */
  private getExcludedBalanceRecommendationsByCategory(
    categoryBalanceRecommendations: BalanceRecommendationData[],
    category: Category,
  ): BalanceRecommendationData[] {
    // 편입 대상 종목 목록 조회
    const includedBalanceRecommendations = this.getIncludedBalanceRecommendationsByCategory(
      categoryBalanceRecommendations,
      category as Category,
    );
    // 편입 대상에 포함되지 않은 종목들을 편출 대상으로 선정
    return this.sortBalanceRecommendations(categoryBalanceRecommendations).filter(
      (item) => !includedBalanceRecommendations.includes(item),
    );
  }

  /**
   * 추론 결과 정렬
   *
   * - 우선순위: 기존 보유 종목 > buyScore 높은 순
   * - 기존 보유 종목(hasStock=true)을 우선 정렬하고, 그 다음 buyScore 내림차순으로 정렬합니다.
   *
   * @param inferences 추론 결과 목록
   * @returns 정렬된 추론 결과 목록
   */
  private sortBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    // 정렬 우선순위:
    // 1. 기존 보유 종목(hasStock=true) 우선
    // 2. 둘 다 보유 종목이거나 둘 다 아닌 경우: buyScore 내림차순
    return inferences.sort((a, b) => {
      // 둘 다 보유 종목이면 순서 유지
      if (a.hasStock && b.hasStock) {
        return 0;
      } else if (a.hasStock) {
        // a만 보유 종목이면 앞으로
        return -1;
      } else if (b.hasStock) {
        // b만 보유 종목이면 앞으로
        return 1;
      }

      // 둘 다 보유 종목이 아니면 buyScore 비교
      const buyScoreDiff = this.getBuyPriorityScore(b) - this.getBuyPriorityScore(a);

      // buyScore가 유사하면 intensity, 추천 weight/confidence 순으로 정렬
      if (Math.abs(buyScoreDiff) < Number.EPSILON) {
        const intensityDiff = b.intensity - a.intensity;
        if (Math.abs(intensityDiff) >= Number.EPSILON) {
          return intensityDiff;
        }

        const scoreDiff = this.getRecommendationScore(b) - this.getRecommendationScore(a);
        if (Math.abs(scoreDiff) < Number.EPSILON) {
          return 0;
        }
        return scoreDiff;
      }

      // buyScore 내림차순 정렬
      return buyScoreDiff;
    });
  }

  /**
   * 정렬된 추론 결과 병합
   *
   * - 카테고리별로 정렬된 결과를 하나의 배열로 병합하고 다시 정렬합니다.
   *
   * @param results 카테고리별 정렬된 추론 결과 배열
   * @returns 병합 및 정렬된 추론 결과 목록
   */
  private mergeSortedBalanceRecommendations(results: BalanceRecommendationData[][]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(results.flat());
  }

  /**
   * 추론에 없는 기존 보유 종목 매도 요청 생성
   *
   * - 사용자가 보유 중이지만 추론 결과에 포함되지 않은 종목을 매도 대상으로 합니다.
   * - diff를 -1로 설정하여 즉시 매도하도록 합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @returns 매도 요청 목록
   */
  private generateNonBalanceRecommendationTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 추론에 없는 기존 보유 종목 매도 요청 생성
    const tradeRequests: TradeRequest[] = balances.info
      .filter((item) => {
        const tradableBalance = parseFloat(item.balance || 0);
        const symbol = `${item.currency}/${item.unit_currency}`;
        // 필터링 조건:
        // 1. KRW가 아닌 종목 (currency !== unit_currency)
        // 2. 거래 가능 잔고가 존재
        // 3. 추론 결과에 포함되지 않은 종목
        // 4. KRW/거래가능 심볼
        // 5. 최소 주문 금액 이상
        return (
          item.currency !== item.unit_currency &&
          tradableBalance > 0 &&
          !inferences.some((inference) => inference.symbol === symbol) &&
          this.isOrderableSymbol(symbol, orderableSymbols) &&
          this.isSellAmountSufficient(symbol, -1, tradableMarketValueMap)
        );
      })
      .map((item) => ({
        symbol: `${item.currency}/${item.unit_currency}`,
        diff: -1, // -1은 완전 매도를 의미
        balances,
        marketPrice,
      }));

    return tradeRequests;
  }

  /**
   * 편입 거래 요청 생성
   *
   * - 편입 대상 종목들에 대한 매수/매도 거래 요청을 생성합니다.
   * - diff를 계산하여 목표 비율과 현재 비율의 차이를 구합니다.
   * - diff가 작은 순서대로 정렬하여 우선순위를 결정합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @param count 편입할 최대 종목 수
   * @returns 편입 거래 요청 목록 (diff 오름차순 정렬)
   */
  private generateIncludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
    regimeMultiplier: number,
    currentWeights: Map<string, number>,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 편입 대상 종목 선정 (최대 count개)
    const filteredBalanceRecommendations = this.filterIncludedBalanceRecommendations(inferences).slice(0, count);
    const topK = Math.max(1, count);

    // 편입 거래 요청 생성
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .map((inference) => {
        if (!this.isOrderableSymbol(inference.symbol, orderableSymbols)) {
          return null;
        }

        const baseTargetWeight = this.calculateTargetWeight(inference, regimeMultiplier);
        const targetWeight = this.clamp01(baseTargetWeight / topK);
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;

        // 목표와 현재 비중 차이가 작으면 불필요한 재조정을 생략
        if (!this.shouldRebalance(targetWeight, deltaWeight)) {
          this.logger.log(
            this.i18n.t('logging.inference.balanceRecommendation.skip_rebalance_band', {
              args: {
                symbol: inference.symbol,
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: this.getRebalanceBand(targetWeight),
              },
            }),
          );
          return null;
        }

        // 예상 거래비용(수수료+슬리피지)보다 작은 조정은 생략
        if (!this.passesCostGate(deltaWeight)) {
          this.logger.log(
            this.i18n.t('logging.inference.balanceRecommendation.skip_cost_gate', {
              args: {
                symbol: inference.symbol,
                deltaWeight,
                minEdge: (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER,
              },
            }),
          );
          return null;
        }

        const diff = this.calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || Math.abs(diff) < Number.EPSILON) {
          return null;
        }

        this.logger.log(
          this.i18n.t('logging.inference.balanceRecommendation.trade_delta', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff,
            },
          }),
        );

        if (diff < 0 && !this.isSellAmountSufficient(inference.symbol, diff, tradableMarketValueMap)) {
          return null;
        }

        const tradeRequest: TradeRequest = {
          symbol: inference.symbol,
          diff,
          balances,
          marketPrice,
          inference,
        };

        return tradeRequest;
      })
      .filter((item): item is TradeRequest => item !== null)
      .sort((a, b) => a.diff - b.diff); // 오름차순으로 정렬 (차이가 작은 것부터 처리)

    return tradeRequests;
  }

  /**
   * 편출 거래 요청 생성
   *
   * - 편출 대상 종목들에 대한 매도 거래 요청을 생성합니다.
   * - diff를 -1로 설정하여 즉시 매도하도록 합니다.
   *
   * @param balances 사용자 계좌 잔고
   * @param inferences 추론 결과 목록
   * @param count 편입할 최대 종목 수
   * @returns 편출 거래 요청 목록
   */
  private generateExcludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
    marketPrice: number,
    orderableSymbols?: Set<string>,
    tradableMarketValueMap?: Map<string, number>,
  ): TradeRequest[] {
    // 편출 대상 종목 선정:
    // 1. 편입 대상 중 count개를 초과한 종목들 (slice(count))
    // 2. 편출 대상 종목들 (편입 대상에 포함되지 않은 종목)
    const filteredBalanceRecommendations = [
      ...this.filterIncludedBalanceRecommendations(inferences).slice(count),
      ...this.filterExcludedBalanceRecommendations(inferences),
    ];

    // 편출 거래 요청 생성: 모두 완전 매도(diff: -1)
    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .filter(
        (inference) =>
          this.isOrderableSymbol(inference.symbol, orderableSymbols) &&
          this.isSellAmountSufficient(inference.symbol, -1, tradableMarketValueMap),
      )
      .map((inference) => ({
        symbol: inference.symbol,
        diff: -1, // -1은 완전 매도를 의미
        balances,
        marketPrice,
        inference,
      }));

    return tradeRequests;
  }

  private getRecommendationScore(item: Pick<BalanceRecommendationData, 'weight' | 'confidence'>): number {
    const weight = item.weight ?? 0.1;
    const confidence = item.confidence ?? 0.7;
    return weight * 0.6 + confidence * 0.4;
  }

  private getBuyPriorityScore(item: Pick<BalanceRecommendationData, 'buyScore' | 'intensity'>): number {
    if (item.buyScore != null && Number.isFinite(item.buyScore)) {
      return this.clamp01(item.buyScore);
    }

    return this.clamp01(item.intensity);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return this.clamp(value, 0, 1);
  }

  private isIncludedRecommendation(inference: BalanceRecommendationData): boolean {
    if (inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)) {
      return this.clamp01(inference.modelTargetWeight) > 0;
    }

    return inference.intensity > this.MINIMUM_TRADE_INTENSITY;
  }

  private calculateFeatureScore(marketFeatures: MarketFeatures | null): number {
    // feature 추출이 실패한 경우, 보수적으로 0점 처리하여 매수 편향을 방지합니다.
    if (!marketFeatures) {
      return 0;
    }

    const confidence = this.clamp01((marketFeatures.prediction?.confidence ?? 0) / 100);
    const momentumStrength = this.clamp01((marketFeatures.prediction?.momentumStrength ?? 0) / 100);
    const liquidityScore = this.clamp01((marketFeatures.liquidityScore ?? 0) / 10);
    const volatility = Number.isFinite(marketFeatures.volatility)
      ? (marketFeatures.volatility as number)
      : this.VOLATILITY_REFERENCE;
    const volatilityRatio = this.clamp01(volatility / this.VOLATILITY_REFERENCE);
    const volatilityScore = this.clamp01(1 - volatilityRatio);
    const intensityStability = this.clamp01((marketFeatures.intensityVolatility?.intensityStability ?? 0) / 100);

    return this.clamp01(
      this.FEATURE_CONFIDENCE_WEIGHT * confidence +
        this.FEATURE_MOMENTUM_WEIGHT * momentumStrength +
        this.FEATURE_LIQUIDITY_WEIGHT * liquidityScore +
        this.FEATURE_VOLATILITY_WEIGHT * volatilityScore +
        this.FEATURE_STABILITY_WEIGHT * intensityStability,
    );
  }

  private resolveAction(intensity: number, sellScore: number, modelTargetWeight: number): BalanceRecommendationAction {
    if (modelTargetWeight <= 0) {
      if (intensity <= this.MINIMUM_TRADE_INTENSITY || sellScore >= this.SELL_SCORE_THRESHOLD) {
        return 'sell';
      }
      return 'hold';
    }

    return 'buy';
  }

  private calculateModelSignals(
    intensity: number,
    category: Category,
    marketFeatures: MarketFeatures | null,
    symbol?: string,
  ) {
    const aiBuy = this.clamp01(intensity);
    const aiSell = this.clamp01(-intensity);
    const featureScore = this.calculateFeatureScore(marketFeatures);

    const buyScore = this.clamp01(this.AI_SIGNAL_WEIGHT * aiBuy + this.FEATURE_SIGNAL_WEIGHT * featureScore);
    const sellScore = this.clamp01(this.AI_SIGNAL_WEIGHT * aiSell + this.FEATURE_SIGNAL_WEIGHT * (1 - featureScore));

    let modelTargetWeight = this.clamp01(buyScore);
    if (intensity <= this.MINIMUM_TRADE_INTENSITY || sellScore >= this.SELL_SCORE_THRESHOLD) {
      modelTargetWeight = 0;
    }

    const action = this.resolveAction(intensity, sellScore, modelTargetWeight);
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.model_signal', {
        args: {
          symbol: symbol ?? 'N/A',
          intensity,
          category,
          featureScore,
          buyScore,
          sellScore,
          modelTargetWeight,
          action,
        },
      }),
    );

    return {
      buyScore,
      sellScore,
      modelTargetWeight,
      action,
    };
  }

  private calculateTargetWeight(inference: BalanceRecommendationData, regimeMultiplier: number): number {
    const baseTargetWeight =
      inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)
        ? this.clamp01(inference.modelTargetWeight)
        : this.calculateModelSignals(inference.intensity, inference.category, null, inference.symbol).modelTargetWeight;

    if (baseTargetWeight <= 0) {
      return 0;
    }

    const adjustedTargetWeight = baseTargetWeight * (Number.isFinite(regimeMultiplier) ? regimeMultiplier : 1);
    const modelTargetWeight = this.clamp01(adjustedTargetWeight);
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.target_weight', {
        args: {
          symbol: inference.symbol,
          baseTargetWeight,
          regimeMultiplier,
          modelTargetWeight,
        },
      }),
    );
    return modelTargetWeight;
  }

  private getRebalanceBand(targetWeight: number): number {
    return Math.max(this.MIN_REBALANCE_BAND, targetWeight * this.REBALANCE_BAND_RATIO);
  }

  private shouldRebalance(targetWeight: number, deltaWeight: number): boolean {
    return Math.abs(deltaWeight) >= this.getRebalanceBand(targetWeight);
  }

  private passesCostGate(deltaWeight: number): boolean {
    const minEdge = (this.ESTIMATED_FEE_RATE + this.ESTIMATED_SLIPPAGE_RATE) * this.COST_GUARD_MULTIPLIER;
    return Math.abs(deltaWeight) >= minEdge;
  }

  private calculateRelativeDiff(targetWeight: number, currentWeight: number): number {
    return (targetWeight - currentWeight) / (currentWeight || 1);
  }

  private async getMarketRegimeMultiplier(): Promise<number> {
    try {
      const feargreed = await this.errorService.retryWithFallback(() => this.feargreedService.getCompactFeargreed());
      const value = Number(feargreed?.value);

      if (!Number.isFinite(value)) {
        return 1;
      }

      if (value <= 20) return 0.95;
      if (value <= 35) return 0.97;
      if (value >= 80) return 0.97;
      if (value >= 65) return 0.99;

      return 1;
    } catch {
      return 1;
    }
  }

  private async buildCurrentWeightMap(
    balances: Balances,
    totalMarketValue: number,
    orderableSymbols?: Set<string>,
  ): Promise<Map<string, number>> {
    const weightMap = new Map<string, number>();

    if (!Number.isFinite(totalMarketValue) || totalMarketValue <= 0) {
      return weightMap;
    }

    const weights = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || 0);

          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, weight: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, weight: 0 };
          }

          try {
            const currPrice = await this.upbitService.getPrice(symbol);
            return { symbol, weight: (tradableBalance * currPrice) / totalMarketValue };
          } catch {
            const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return null;
            }

            return { symbol, weight: (tradableBalance * avgBuyPrice) / totalMarketValue };
          }
        }),
    );

    for (const item of weights) {
      if (!item) {
        continue;
      }

      const { symbol, weight } = item;
      if (weight > 0) {
        weightMap.set(symbol, weight);
      }
    }

    return weightMap;
  }

  private isKrwSymbol(symbol: string): boolean {
    return symbol.endsWith('/KRW');
  }

  private isOrderableSymbol(symbol: string, orderableSymbols?: Set<string>): boolean {
    if (!this.isKrwSymbol(symbol)) {
      return false;
    }

    if (!orderableSymbols) {
      return true;
    }

    return orderableSymbols.has(symbol);
  }

  private isSellAmountSufficient(symbol: string, diff: number, tradableMarketValueMap?: Map<string, number>): boolean {
    if (!tradableMarketValueMap) {
      return true;
    }

    const tradableMarketValue = tradableMarketValueMap.get(symbol);
    if (tradableMarketValue == null) {
      return true;
    }

    if (!Number.isFinite(tradableMarketValue) || tradableMarketValue <= 0) {
      return false;
    }

    return tradableMarketValue * Math.abs(diff) >= UPBIT_MINIMUM_TRADE_PRICE;
  }

  private async buildOrderableSymbolSet(symbols: string[]): Promise<Set<string> | undefined> {
    const targets = Array.from(new Set(symbols.filter((symbol) => this.isKrwSymbol(symbol))));
    if (targets.length < 1) {
      return new Set();
    }

    const checks = await Promise.all(
      targets.map(async (symbol) => {
        try {
          return {
            symbol,
            checked: true,
            exists: await this.upbitService.isSymbolExist(symbol),
          };
        } catch {
          return { symbol, checked: false, exists: false };
        }
      }),
    );

    const checkedCount = checks.filter((check) => check.checked).length;
    if (checkedCount < 1) {
      this.logger.warn(this.i18n.t('logging.inference.balanceRecommendation.orderable_symbol_check_failed'));
      return undefined;
    }

    if (checkedCount < checks.length) {
      this.logger.warn(this.i18n.t('logging.inference.balanceRecommendation.orderable_symbol_check_partial'));
    }

    return new Set(checks.filter((check) => !check.checked || check.exists).map((check) => check.symbol));
  }

  private async buildTradableMarketValueMap(
    balances: Balances,
    orderableSymbols?: Set<string>,
  ): Promise<Map<string, number>> {
    const marketValueMap = new Map<string, number>();

    const values = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || 0);
          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, marketValue: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, marketValue: 0 };
          }

          try {
            const currPrice = await this.upbitService.getPrice(symbol);
            return { symbol, marketValue: tradableBalance * currPrice };
          } catch {
            const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return { symbol, marketValue: 0 };
            }

            return { symbol, marketValue: tradableBalance * avgBuyPrice };
          }
        }),
    );

    for (const { symbol, marketValue } of values) {
      if (marketValue > 0) {
        marketValueMap.set(symbol, marketValue);
      }
    }

    return marketValueMap;
  }

  /**
   * 사용자별 최대 편입 종목 수 계산
   *
   * - 사용자가 활성화한 카테고리 중 권한이 있는 카테고리만 고려합니다.
   * - 각 카테고리별 최대 종목 수 중 가장 큰 값을 반환합니다.
   *
   * @param user 사용자
   * @returns 최대 편입 종목 수
   */
  private async getItemCount(user: User): Promise<number> {
    // 사용자가 활성화한 카테고리 목록 조회
    const userCategories = await this.categoryService.findEnabledByUser(user);
    const categories = userCategories.map((uc) => uc.category);

    // 권한이 있는 카테고리만 필터링
    const authorizedCategories = categories.filter((category) =>
      this.categoryService.checkCategoryPermission(user, category),
    );

    // 권한이 있는 카테고리가 없으면 0 반환
    if (authorizedCategories.length < 1) {
      return 0;
    }

    // 각 카테고리별 최대 종목 수 중 가장 큰 값을 반환
    // (여러 카테고리를 활성화한 경우 가장 큰 제한을 적용)
    return Math.max(...authorizedCategories.map((category) => this.getItemCountByCategory(category)));
  }

  /**
   * 카테고리별 최대 종목 수 조회
   *
   * @param category 카테고리
   * @returns 카테고리별 최대 종목 수
   */
  private getItemCountByCategory(category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
        return this.COIN_MAJOR_ITEM_COUNT;

      case Category.COIN_MINOR:
        return this.COIN_MINOR_ITEM_COUNT;

      case Category.NASDAQ:
        return this.NASDAQ_ITEM_COUNT;
    }

    return 0;
  }

  /**
   * 클라이언트 캐시 초기화
   *
   * - Upbit 및 Notify 서비스의 클라이언트 캐시를 초기화합니다.
   * - 거래 완료 후 메모리 누수를 방지하기 위해 호출됩니다.
   */
  private clearClients(): void {
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  private toPercent(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) {
      return '-';
    }

    return `${Math.floor(value * 100)}%`;
  }

  /**
   * 개별 거래 실행
   *
   * - 거래 요청을 받아 실제 주문을 생성하고 실행합니다.
   * - 주문 타입(매수/매도), 수량, 수익을 계산하여 Trade 엔티티에 저장합니다.
   *
   * @param user 사용자
   * @param request 거래 요청
   * @returns 생성된 Trade 엔티티 (주문이 없으면 null)
   */
  private async executeTrade(user: User, request: TradeRequest): Promise<Trade> {
    this.logger.log(this.i18n.t('logging.trade.start', { args: { id: user.id, symbol: request.symbol } }));

    // 주문 생성 및 조정: diff 값에 따라 매수/매도 주문 생성
    const order = await this.upbitService.adjustOrder(user, request);

    // 주문이 생성되지 않은 경우 (예: 잔고 부족, 최소 주문 금액 미달 등)
    if (!order) {
      this.logger.log(this.i18n.t('logging.trade.not_exist', { args: { id: user.id, symbol: request.symbol } }));
      return null;
    }

    this.logger.log(this.i18n.t('logging.trade.calculate.start', { args: { id: user.id, symbol: request.symbol } }));

    // 주문 정보 계산: 타입(매수/매도), 수량, 수익
    const type = this.upbitService.getOrderType(order);
    const amount = await this.upbitService.calculateAmount(order);
    const profit = await this.upbitService.calculateProfit(request.balances, order, amount);

    this.logger.log(
      this.i18n.t('logging.trade.calculate.end', {
        args: {
          id: user.id,
          symbol: request.symbol,
          type: this.i18n.t(`label.order.type.${type}`),
          amount,
          profit,
        },
      }),
    );

    this.logger.log(this.i18n.t('logging.trade.save.start', { args: { id: user.id, symbol: request.symbol } }));

    // 거래 정보를 데이터베이스에 저장
    const trade = await this.saveTrade(user, {
      symbol: request.symbol,
      type,
      amount,
      profit,
      inference: request.inference,
    });

    this.logger.log(this.i18n.t('logging.trade.save.end', { args: { id: user.id, symbol: request.symbol } }));

    return trade;
  }

  /**
   * 거래 엔티티 저장
   *
   * - 실행된 거래 정보를 데이터베이스에 저장합니다.
   *
   * @param user 사용자
   * @param data 거래 데이터 (심볼, 타입, 수량, 수익, 추론 정보)
   * @returns 저장된 Trade 엔티티
   */
  private async saveTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.user = user;

    return trade.save();
  }

  /**
   * 메이저 코인 추론 항목 생성
   *
   * - BTC/KRW, ETH/KRW 등 메이저 코인을 추론 대상으로 추가합니다.
   *
   * @returns 메이저 코인 추론 항목 목록
   */
  private async fetchMajorCoinItems(): Promise<RecommendationItem[]> {
    return this.COIN_MAJOR.map((symbol) => ({
      symbol,
      category: Category.COIN_MAJOR,
      hasStock: false,
    }));
  }

  /**
   * 시장 추천 기반 추론 항목 생성
   *
   * - MarketResearch 모듈에서 추천한 종목들을 추론 대상으로 추가합니다.
   * - 최신 추천 결과를 조회하여 RecommendationItem 형식으로 변환합니다.
   *
   * @returns 시장 추천 기반 추론 항목 목록
   */
  private isLatestRecommendationStateFresh(state: MarketRecommendationState | null): boolean {
    if (!state) {
      return false;
    }

    if (!Number.isFinite(state.updatedAt)) {
      return false;
    }

    return Date.now() - state.updatedAt <= MARKET_RECOMMENDATION_STATE_MAX_AGE_MS;
  }

  private hasRecommendationsNewerThanState(
    recommendations: MarketRecommendation[],
    state: MarketRecommendationState,
  ): boolean {
    return recommendations.some((recommendation) => {
      const createdAt =
        recommendation.createdAt instanceof Date
          ? recommendation.createdAt.getTime()
          : new Date(recommendation.createdAt).getTime();

      return Number.isFinite(createdAt) && createdAt > state.updatedAt;
    });
  }

  private hasDifferentRecommendationBatch(
    recommendations: MarketRecommendation[],
    state: MarketRecommendationState,
  ): boolean {
    if (recommendations.length < 1) {
      return false;
    }

    return recommendations[0].batchId !== state.batchId;
  }

  private async fetchRecommendItems(): Promise<RecommendationItem[]> {
    let latestState: MarketRecommendationState | null = null;

    try {
      latestState = await this.cacheService.get<MarketRecommendationState>(MARKET_RECOMMENDATION_STATE_CACHE_KEY);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.schedule.balanceRecommendation.state_cache_read_failed'), error);
    }

    let recommendations: MarketRecommendation[];

    if (!latestState?.batchId || !this.isLatestRecommendationStateFresh(latestState)) {
      this.logger.warn(this.i18n.t('logging.schedule.balanceRecommendation.state_stale_fallback'));
      recommendations = await MarketRecommendation.getLatestRecommends();
    } else if (!latestState.hasRecommendations) {
      const latestRecommendations = await MarketRecommendation.getLatestRecommends();
      if (!this.hasRecommendationsNewerThanState(latestRecommendations, latestState)) {
        return [];
      }

      recommendations = latestRecommendations;
    } else {
      recommendations = await MarketRecommendation.find({
        where: { batchId: latestState.batchId },
      });

      const latestRecommendations = await MarketRecommendation.getLatestRecommends();
      const hasNewerRecommendations = this.hasRecommendationsNewerThanState(latestRecommendations, latestState);
      const hasDifferentBatch = this.hasDifferentRecommendationBatch(latestRecommendations, latestState);

      if (recommendations.length < 1 || hasNewerRecommendations || hasDifferentBatch) {
        recommendations = latestRecommendations;
      }
    }

    const minRecommendConfidence = await this.resolveMinRecommendConfidence();

    const minimumFilteredOutRecommendations = recommendations.filter(
      (recommendation) =>
        Number(recommendation.weight) < this.MIN_RECOMMEND_WEIGHT ||
        Number(recommendation.confidence) < minRecommendConfidence,
    );

    if (minimumFilteredOutRecommendations.length > 0) {
      this.logger.log(
        this.i18n.t('logging.schedule.balanceRecommendation.minimum_filtered', {
          args: {
            count: minimumFilteredOutRecommendations.length,
            symbols: minimumFilteredOutRecommendations.map((recommendation) => recommendation.symbol).join(', '),
          },
        }),
      );
    }

    const filteredRecommendations = recommendations
      .filter(
        (recommendation) =>
          Number(recommendation.weight) >= this.MIN_RECOMMEND_WEIGHT &&
          Number(recommendation.confidence) >= minRecommendConfidence,
      )
      .sort((a, b) => Number(b.weight) * Number(b.confidence) - Number(a.weight) * Number(a.confidence));

    const orderableSymbols = await this.buildOrderableSymbolSet(
      filteredRecommendations.map((recommendation) => recommendation.symbol),
    );

    return filteredRecommendations
      .filter((recommendation) => this.isOrderableSymbol(recommendation.symbol, orderableSymbols))
      .map((recommendation) => ({
        symbol: recommendation.symbol,
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: Number(recommendation.weight),
        confidence: Number(recommendation.confidence),
      }));
  }

  private async resolveMinRecommendConfidence(): Promise<number> {
    try {
      const tunedConfidence = await this.reportValidationService.getRecommendedMarketMinConfidenceForPortfolio();
      if (!Number.isFinite(tunedConfidence)) {
        return this.MIN_RECOMMEND_CONFIDENCE;
      }
      return this.clamp01(tunedConfidence);
    } catch (error) {
      this.logger.warn('Failed to resolve tuned minimum recommendation confidence', error);
      return this.MIN_RECOMMEND_CONFIDENCE;
    }
  }

  /**
   * 블랙리스트 필터링
   *
   * - 중복 종목 제거 및 블랙리스트에 등록된 종목을 제외합니다.
   *
   * @param items 추론 대상 종목 목록
   * @returns 필터링된 추론 대상 종목 목록
   */
  private async filterBalanceRecommendations(items: RecommendationItem[]): Promise<RecommendationItem[]> {
    // 블랙리스트 전체 조회
    const blacklist = await this.blacklistService.findAll();
    const blacklistKeySet = new Set(blacklist.map((item) => `${item.symbol}:${item.category}`));
    const firstIndexBySymbol = new Map<string, number>();
    const blacklistFilteredSymbols = new Set<string>();

    items.forEach((item, index) => {
      if (!firstIndexBySymbol.has(item.symbol)) {
        firstIndexBySymbol.set(item.symbol, index);
      }
    });

    // 중복 및 블랙리스트 제거
    // 1. 중복 제거: 같은 심볼이 여러 번 나타나는 경우 첫 번째만 유지
    // 2. 블랙리스트 필터링: 블랙리스트에 등록된 종목(심볼+카테고리 조합) 제외
    items = items.filter((item, index) => {
      const isFirstSymbol = index === firstIndexBySymbol.get(item.symbol);
      if (!isFirstSymbol) {
        return false;
      }

      const isBlacklisted = blacklistKeySet.has(`${item.symbol}:${item.category}`);
      if (isBlacklisted) {
        blacklistFilteredSymbols.add(item.symbol);
      }

      return !isBlacklisted;
    });

    if (blacklistFilteredSymbols.size > 0) {
      this.logger.log(
        this.i18n.t('logging.schedule.balanceRecommendation.blacklist_filtered', {
          args: {
            count: blacklistFilteredSymbols.size,
            symbols: Array.from(blacklistFilteredSymbols).join(', '),
          },
        }),
      );
    }

    return items;
  }

  /**
   * 선택된 종목들의 매수 비율 추천
   *
   * - AI를 활용하여 각 종목별 매수 비율을 추천합니다.
   * - 실시간 API 호출을 병렬로 처리하여 성능을 최적화합니다.
   * - 추천 결과를 데이터베이스에 저장합니다.
   *
   * @param items 분석할 종목 목록 (hasStock 정보 포함)
   * @returns 저장된 각 종목별 매수 비율 추천 결과
   */
  public async balanceRecommendation(items: RecommendationItem[]): Promise<BalanceRecommendationData[]> {
    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.start', { args: { count: items.length } }));
    const previousMetrics = await this.buildPreviousMetricsMap(items);

    // 각 종목에 대한 실시간 API 호출을 병렬로 처리
    const inferenceResults = await Promise.all(
      items.map((item) => {
        return this.errorService.retryWithFallback(async () => {
          const targetSymbol =
            item.category === Category.NASDAQ ? item.symbol : (normalizeKrwSymbol(item.symbol) ?? item.symbol);
          if (targetSymbol !== item.symbol) {
            this.logger.warn(
              this.i18n.t('logging.inference.balanceRecommendation.symbol_normalized', {
                args: {
                  from: item.symbol,
                  to: targetSymbol,
                },
              }),
            );
          }

          const { messages, marketFeatures } = await this.buildBalanceRecommendationMessages(targetSymbol);

          const requestConfig = {
            ...UPBIT_BALANCE_RECOMMENDATION_CONFIG,
            text: {
              format: {
                type: 'json_schema' as const,
                name: 'balance_recommendation',
                strict: true,
                schema: UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA as Record<string, unknown>,
              },
            },
          };

          // 실시간 API 호출 (Responses API + web_search)
          const response = await this.openaiService.createResponse(messages, requestConfig);
          const output = this.openaiService.getResponseOutput(response);
          const outputText = output.text;
          if (!outputText || outputText.trim() === '') {
            return null;
          }
          const responseData = JSON.parse(outputText);
          const intensity = Number(responseData?.intensity);
          const safeIntensity = Number.isFinite(intensity) ? intensity : 0;
          const reason = typeof responseData?.reason === 'string' ? responseData.reason.trim() : '';
          const modelSignals = this.calculateModelSignals(safeIntensity, item.category, marketFeatures, targetSymbol);
          const previousMetricsBySymbol = previousMetrics.get(targetSymbol) ?? previousMetrics.get(item.symbol);

          // 추론 결과와 아이템 병합
          return {
            ...responseData,
            symbol: targetSymbol,
            intensity: safeIntensity,
            reason: reason.length > 0 ? reason : null,
            category: item?.category,
            hasStock: item?.hasStock || false,
            prevIntensity: previousMetricsBySymbol?.intensity ?? null,
            prevModelTargetWeight: previousMetricsBySymbol?.modelTargetWeight ?? null,
            weight: item?.weight,
            confidence: item?.confidence,
            buyScore: modelSignals.buyScore,
            sellScore: modelSignals.sellScore,
            modelTargetWeight: modelSignals.modelTargetWeight,
            action: modelSignals.action,
          };
        });
      }),
    );

    const validResults = inferenceResults.filter((r): r is NonNullable<typeof r> => r != null);

    // 추론 결과가 없으면 빈 배열 반환
    if (validResults.length === 0) {
      this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));
      return [];
    }

    // 결과 저장
    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.presave', { args: { count: validResults.length } }),
    );

    const batchId = randomUUID();
    const recommendationResults = await Promise.all(
      validResults.map((recommendation) => this.saveBalanceRecommendation({ ...recommendation, batchId })),
    );

    this.logger.log(
      this.i18n.t('logging.inference.balanceRecommendation.save', { args: { count: recommendationResults.length } }),
    );

    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));
    this.reportValidationService
      .enqueuePortfolioBatchValidation(batchId)
      .catch((error) =>
        this.logger.warn(this.i18n.t('logging.inference.balanceRecommendation.enqueue_validation_failed'), error),
      );

    return recommendationResults.map((saved, index) => ({
      id: saved.id,
      batchId: saved.batchId,
      symbol: saved.symbol,
      category: saved.category,
      intensity: saved.intensity,
      prevIntensity: saved.prevIntensity != null ? Number(saved.prevIntensity) : null,
      prevModelTargetWeight: validResults[index].prevModelTargetWeight ?? null,
      buyScore: saved.buyScore,
      sellScore: saved.sellScore,
      modelTargetWeight: saved.modelTargetWeight,
      action: saved.action,
      reason: saved.reason != null ? toUserFacingText(saved.reason) : null,
      hasStock: validResults[index].hasStock,
      weight: validResults[index].weight,
      confidence: validResults[index].confidence,
    }));
  }

  /**
   * 포트폴리오 분석 메시지 빌드
   *
   * - 뉴스, 공포탐욕지수, 이전 추론, 개별 종목 특성 데이터를 포함한 프롬프트를 구성합니다.
   *
   * @param symbol 종목 심볼
   * @returns OpenAI API용 메시지 배열과 score 계산용 feature
   */
  private async buildBalanceRecommendationMessages(
    symbol: string,
  ): Promise<{ messages: EasyInputMessage[]; marketFeatures: MarketFeatures | null }> {
    const messages: EasyInputMessage[] = [];

    // 시스템 프롬프트 추가
    this.openaiService.addMessage(messages, 'system', UPBIT_BALANCE_RECOMMENDATION_PROMPT);

    // 뉴스 데이터 추가
    const news = await this.fetchNewsData();
    if (news && news.length > 0) {
      this.openaiService.addMessagePair(messages, 'prompt.input.news', news);
    }

    // 공포탐욕지수 추가
    const feargreed = await this.fetchFearGreedData();
    if (feargreed) {
      this.openaiService.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    try {
      const validationSummary = await this.reportValidationService.buildPortfolioValidationGuardrailText(symbol);
      if (validationSummary) {
        this.openaiService.addMessagePair(messages, 'prompt.input.validation_portfolio', validationSummary);
      }
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.inference.balanceRecommendation.validation_guardrail_load_failed', {
          args: { symbol },
        }),
        error,
      );
    }

    // 개별 종목 feature 데이터 추가
    const marketFeatures = await this.featureService.extractMarketFeatures(symbol);

    const marketData = this.featureService.formatMarketData([marketFeatures]);
    this.openaiService.addMessage(messages, 'user', `${this.featureService.MARKET_DATA_LEGEND}\n\n${marketData}`);

    return { messages, marketFeatures };
  }

  /**
   * 뉴스 데이터 가져오기
   *
   * - 최근 100개의 중요 뉴스를 조회합니다.
   *
   * @returns 뉴스 데이터 배열
   */
  private async fetchNewsData(): Promise<CompactNews[]> {
    const operation = () =>
      this.newsService.getCompactNews({
        type: NewsTypes.COIN,
        limit: 100,
        importanceLower: 1,
        skip: false,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.news.load_failed'), error);
      return [];
    }
  }

  /**
   * 공포탐욕지수 데이터 가져오기
   *
   * - 최신 공포탐욕지수를 조회합니다.
   *
   * @returns 공포탐욕지수 데이터 또는 null
   */
  private async fetchFearGreedData(): Promise<CompactFeargreed | null> {
    const operation = () => this.feargreedService.getCompactFeargreed();

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.feargreed.load_failed'), error);
      return null;
    }
  }

  /**
   * 최신 이전 추론 데이터 가져오기
   *
   * - 기간 제한 없이 가장 최근 추론 1건을 조회합니다.
   *
   * @param symbol 종목 심볼
   * @returns 이전 추론 결과 배열 (최대 1건)
   */
  private async fetchRecentRecommendations(symbol: string): Promise<BalanceRecommendation[]> {
    const operation = () =>
      BalanceRecommendation.find({
        where: { symbol },
        order: { createdAt: 'DESC' },
        take: 1,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.recent_recommendations_failed'), error);
      return [];
    }
  }

  private async buildPreviousMetricsMap(
    items: RecommendationItem[],
  ): Promise<Map<string, { intensity: number | null; modelTargetWeight: number | null }>> {
    const symbols = Array.from(new Set(items.map((item) => item.symbol)));
    const previousMetrics = await Promise.all(
      symbols.map(async (symbol) => {
        const recentRecommendations = await this.fetchRecentRecommendations(symbol);
        const latestRecommendation = recentRecommendations[0];
        const latestIntensity =
          latestRecommendation?.intensity != null && Number.isFinite(latestRecommendation.intensity)
            ? Number(latestRecommendation.intensity)
            : null;
        const latestModelTargetWeight =
          latestRecommendation?.modelTargetWeight != null && Number.isFinite(latestRecommendation.modelTargetWeight)
            ? Number(latestRecommendation.modelTargetWeight)
            : null;

        return [
          symbol,
          {
            intensity: latestIntensity,
            modelTargetWeight: latestModelTargetWeight,
          },
        ] as const;
      }),
    );

    return new Map(previousMetrics);
  }

  /**
   * 잔고 추천 결과 페이지네이션
   *
   * @param params 페이지네이션 파라미터
   * @returns 페이지네이션된 잔고 추천 결과
   */
  public async paginateBalanceRecommendations(
    params: GetBalanceRecommendationsPaginationDto,
  ): Promise<PaginatedItem<BalanceRecommendationDto>> {
    const paginatedResult = await BalanceRecommendation.paginate(params);
    const badgeMap = await this.getPortfolioValidationBadgeMapSafe(paginatedResult.items.map((entity) => entity.id));
    const items = await Promise.all(
      paginatedResult.items.map(async (entity) => ({
        id: entity.id,
        seq: entity.seq,
        symbol: entity.symbol,
        category: entity.category,
        intensity: entity.intensity,
        prevIntensity: entity.prevIntensity != null ? Number(entity.prevIntensity) : null,
        prevModelTargetWeight: await this.findPreviousModelTargetWeight(entity),
        buyScore: entity.buyScore,
        sellScore: entity.sellScore,
        modelTargetWeight: entity.modelTargetWeight,
        action: entity.action,
        reason: entity.reason != null ? toUserFacingText(entity.reason) : null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        validation24h: badgeMap.get(entity.id)?.validation24h,
        validation72h: badgeMap.get(entity.id)?.validation72h,
      })),
    );

    return {
      ...paginatedResult,
      items,
    };
  }

  /**
   * 잔고 추천 결과 커서 페이지네이션
   *
   * @param params 커서 페이지네이션 파라미터
   * @returns 커서 페이지네이션된 잔고 추천 결과
   */
  public async cursorBalanceRecommendations(
    params: GetBalanceRecommendationsCursorDto,
  ): Promise<CursorItem<BalanceRecommendationDto, string>> {
    const cursorResult = await BalanceRecommendation.cursor(params);
    const badgeMap = await this.getPortfolioValidationBadgeMapSafe(cursorResult.items.map((entity) => entity.id));
    const items = await Promise.all(
      cursorResult.items.map(async (entity) => ({
        id: entity.id,
        seq: entity.seq,
        symbol: entity.symbol,
        category: entity.category,
        intensity: entity.intensity,
        prevIntensity: entity.prevIntensity != null ? Number(entity.prevIntensity) : null,
        prevModelTargetWeight: await this.findPreviousModelTargetWeight(entity),
        buyScore: entity.buyScore,
        sellScore: entity.sellScore,
        modelTargetWeight: entity.modelTargetWeight,
        action: entity.action,
        reason: entity.reason != null ? toUserFacingText(entity.reason) : null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        validation24h: badgeMap.get(entity.id)?.validation24h,
        validation72h: badgeMap.get(entity.id)?.validation72h,
      })),
    );

    return {
      ...cursorResult,
      items,
    };
  }

  /**
   * 잔고 추천 결과 저장
   *
   * @param recommendation 잔고 추천 데이터
   * @returns 저장된 잔고 추천 엔티티
   */
  public async saveBalanceRecommendation(recommendation: BalanceRecommendationData): Promise<BalanceRecommendation> {
    const normalizedSymbol =
      recommendation.category === Category.NASDAQ
        ? recommendation.symbol?.trim().toUpperCase()
        : normalizeKrwSymbol(recommendation.symbol);
    if (!normalizedSymbol) {
      throw new Error(`Invalid balance recommendation symbol: ${recommendation.symbol}`);
    }

    const balanceRecommendation = new BalanceRecommendation();
    Object.assign(balanceRecommendation, recommendation, { symbol: normalizedSymbol });
    return balanceRecommendation.save();
  }

  private async findPreviousModelTargetWeight(entity: BalanceRecommendation): Promise<number | null> {
    try {
      const previous = await BalanceRecommendation.createQueryBuilder('recommendation')
        .select(['recommendation.modelTargetWeight'])
        .where('recommendation.symbol = :symbol', { symbol: entity.symbol })
        .andWhere('recommendation.category = :category', { category: entity.category })
        .andWhere('recommendation.seq < :seq', { seq: entity.seq })
        .orderBy('recommendation.seq', 'DESC')
        .getOne();

      if (previous?.modelTargetWeight != null && Number.isFinite(previous.modelTargetWeight)) {
        return Number(previous.modelTargetWeight);
      }
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.inference.balanceRecommendation.prev_target_weight_failed', {
          args: { symbol: entity.symbol, seq: entity.seq },
        }),
        error,
      );
    }

    return null;
  }

  private async getPortfolioValidationBadgeMapSafe(ids: string[]) {
    try {
      return await this.reportValidationService.getPortfolioValidationBadgeMap(ids);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.inference.balanceRecommendation.validation_badges_load_failed'), error);
      return new Map();
    }
  }
}
