import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';

import { InferenceService } from '@/modules/inference/inference.service';
import { TradeService } from '@/modules/trade/trade.service';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { User } from '@/modules/user/entities/user.entity';

import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { HistoryService } from '../history/history.service';
import { MarketRecommendation } from '../inference/entities/market-recommendation.entity';
import { MarketRecommendationResponse, RecommendationItem } from '../inference/inference.interface';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { Schedule } from './entities/schedule.entity';
import { ScheduleExpression } from './schedule.enum';
import { ScheduleData } from './schedule.interface';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;

  constructor(
    private readonly i18n: I18nService,
    private readonly tradeService: TradeService,
    private readonly blacklistService: BlacklistService,
    private readonly historyService: HistoryService,
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
  ) {}

  @Cron(ScheduleExpression.DAILY_MARKET_RECOMMENDATION)
  @WithRedlock({ duration: 10 * 60 * 1000 })
  public async marketRecommendation(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.marketRecommendation.start'));

    try {
      // 모든 KRW 마켓 종목 가져오기
      const allKrwSymbols = await this.upbitService.getAllKrwMarkets();

      // RecommendationItem 형식으로 변환
      let inferenceItems: RecommendationItem[] = allKrwSymbols.map((symbol) => ({
        ticker: symbol,
        category: Category.COIN_MINOR, // 기본 카테고리를 COIN_MINOR로 설정
        hasStock: false,
      }));

      // 블랙리스트 필터링
      inferenceItems = await this.filterBalanceRecommendations(inferenceItems);
      const filteredSymbols = inferenceItems.map((item) => item.ticker);

      this.logger.log(
        this.i18n.t('logging.schedule.marketRecommendation.filtered', { args: { count: filteredSymbols.length } }),
      );

      // 필터링된 종목으로 추천 요청
      const { recommendations }: MarketRecommendationResponse =
        await this.inferenceService.marketRecommendation(filteredSymbols);

      this.logger.log(
        this.i18n.t('logging.schedule.marketRecommendation.completed', {
          args: {
            count: recommendations?.length || 0,
          },
        }),
      );
    } catch (error) {
      this.logger.error(this.i18n.t('logging.schedule.marketRecommendation.failed'), error);
    }
  }

  @Cron(ScheduleExpression.DAILY_BALANCE_RECOMMENDATION_NEW)
  @WithRedlock({ duration: 5 * 60 * 1000 })
  public async balanceRecommendationNew(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.start'));

    const users = await this.getUsers();

    // 기존 보유 항목 재추론
    const historyItems = await this.historyService.fetchHistory();

    // 메이저 코인, 추천 코인, 나스닥 종목 추론
    const majorCoinItems = await this.fetchMajorCoinItems();
    const recommendItems = await this.fetchRecommendItems();

    // 우선 순위를 반영해 추론 종목 목록 정리
    const allItems = [...historyItems, ...majorCoinItems, ...recommendItems];
    const items = await this.filterBalanceRecommendations(allItems);

    // 추론 시작
    await this.tradeService.processItems(users, items, true);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  @Cron(ScheduleExpression.DAILY_BALANCE_RECOMMENDATION_EXISTING)
  @WithRedlock({ duration: 5 * 60 * 1000 })
  public async balanceRecommendationExisting(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.start'));

    const users = await this.getUsers();

    // 기존 보유 항목 재추론
    const historyItems = await this.historyService.fetchHistory();

    // 추론 종목 목록 정리
    const items = await this.filterBalanceRecommendations(historyItems);

    // 추론 시작
    await this.tradeService.processItems(users, items, true);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  public async create(user: User, data: ScheduleData): Promise<Schedule> {
    let schedule = await this.read(user);

    if (!schedule) {
      schedule = new Schedule();
    }

    schedule.user = user;
    Object.assign(schedule, data);

    return schedule.save();
  }

  public async read(user: User): Promise<Schedule> {
    return Schedule.findByUser(user);
  }

  public async getUsers(): Promise<User[]> {
    const schedules = await Schedule.findByEnabled();
    const users = schedules.map((schedule) => schedule.user);

    return users;
  }

  private async fetchMajorCoinItems(): Promise<RecommendationItem[]> {
    return this.COIN_MAJOR.map((ticker) => ({
      ticker,
      category: Category.COIN_MAJOR,
      hasStock: false,
    }));
  }

  /**
   * recommend 기반 추론 항목 생성
   */
  private async fetchRecommendItems(): Promise<RecommendationItem[]> {
    const recommendations = await MarketRecommendation.getLatestRecommends();

    return recommendations.map((recommendation) => ({
      ticker: recommendation.symbol,
      category: Category.COIN_MINOR,
      hasStock: false,
    }));
  }

  private async filterBalanceRecommendations(items: RecommendationItem[]): Promise<RecommendationItem[]> {
    const blacklist = await this.blacklistService.findAll();

    // 중복 및 블랙리스트 제거
    items = items.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.ticker === item.ticker) &&
        !blacklist.some((t) => t.ticker === item.ticker && t.category === item.category),
    );

    return items;
  }
}
