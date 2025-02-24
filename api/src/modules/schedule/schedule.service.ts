import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';

import { AccumulationService } from '../accumulation/accumulation.service';
import { GetAccumulationDto } from '../accumulation/dto/get-accumulation.dto';
import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { HistoryService } from '../history/history.service';
import { InferenceItem } from '../inference/inference.interface';
import { SortDirection } from '../item/item.enum';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { TradeService } from '../trade/trade.service';
import { User } from '../user/entities/user.entity';
import { Schedule } from './entities/schedule.entity';
import { ScheduleExpression } from './schedule.enum';
import { ScheduleData } from './schedule.interface';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;
  private readonly COIN_MINOR_REQUEST: GetAccumulationDto = {
    market: 'KRW',
    open: true,
    distinct: true,
    display: 10,
    order: 'updated_at',
    sortDirection: SortDirection.DESC,
    priceRateLower: -0.04,
    priceRateUpper: 0.02,
    accTradePriceLower: 10 ** 10,
    strengthLower: 0.8,
  };

  constructor(
    private readonly i18n: I18nService,
    private readonly tradeService: TradeService,
    private readonly accumulationService: AccumulationService,
    private readonly blacklistService: BlacklistService,
    private readonly historyService: HistoryService,
  ) {}

  @Cron(ScheduleExpression.EVERY_4_HOURS_WITH_NEW_ITEMS)
  @WithRedlock({ duration: 5 * 60 * 1000 })
  public async processWithNewItems(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.start'));

    const users = await this.getUsers();

    const items = await this.filterInferenceItems([
      ...(await this.historyService.fetchHistoryInferences()),
      ...(await this.fetchMajorCoinInferences()),
      ...(await this.fetchMinorCoinInferences()),
      ...(await this.fetchNasdaqInferences()),
    ]);

    await this.tradeService.processItems(users, items, true);

    this.logger.log(this.i18n.t('logging.schedule.end'));
  }

  @Cron(ScheduleExpression.EVERY_30_MINUTES_WITH_EXIST_ITEMS)
  @WithRedlock({ duration: 5 * 60 * 1000 })
  public async processWithExistItems(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.start'));

    const users = await this.getUsers();
    const items = await this.filterInferenceItems(await this.historyService.fetchHistoryInferences());
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

  private async fetchMajorCoinInferences(): Promise<InferenceItem[]> {
    return this.COIN_MAJOR.map((ticker) => ({
      ticker,
      category: Category.COIN_MAJOR,
      hasStock: false,
    }));
  }

  private async fetchMinorCoinInferences(): Promise<InferenceItem[]> {
    const items = await this.accumulationService.getAllAccumulations(this.COIN_MINOR_REQUEST);

    return items.map((item) => ({
      ticker: `${item.symbol}/${item.market}`,
      category: Category.COIN_MINOR,
      hasStock: false,
    }));
  }

  // TO-DO: NASDAQ 종목 추론
  private async fetchNasdaqInferences(): Promise<InferenceItem[]> {
    return [];
  }

  private async filterInferenceItems(items: InferenceItem[]): Promise<InferenceItem[]> {
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
