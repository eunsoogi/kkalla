import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';

import { PostTradeDto } from '../trade/dto/post-trade.dto';
import { Trade } from '../trade/entities/trade.entity';
import { TradeService } from '../trade/trade.service';
import { User } from '../user/entities/user.entity';
import { Schedule } from './entities/schedule.entity';
import { ScheduleData } from './schedule.interface';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly tradeService: TradeService,
    private readonly i18n: I18nService,
  ) {}

  @Cron(CronExpression.EVERY_4_HOURS)
  public async tradeSchedule(): Promise<Trade[]> {
    this.logger.log(this.i18n.t('logging.schedule.start'));

    const schedules = await Schedule.findByEnabled();

    // TO-DO: dynamic symbol & market
    const request = new PostTradeDto();

    const inference = await this.tradeService.inference(request);

    const trades = await Promise.all(
      schedules.map((schedule) => this.tradeService.trade(schedule.user, inference, request)),
    );

    this.logger.log(this.i18n.t('logging.schedule.end'));

    return trades;
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
}
