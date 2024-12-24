import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';

import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { TradeService } from '../trade/trade.service';
import { User } from '../user/entities/user.entity';
import { Schedule } from './entities/schedule.entity';
import { ScheduleExpression } from './schedule.enum';
import { ScheduleData } from './schedule.interface';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly tradeService: TradeService,
    private readonly i18n: I18nService,
  ) {}

  @Cron(ScheduleExpression.EVERY_HOUR_AT_20_50_MINUTE)
  @WithRedlock({ duration: 5 * 60 * 1000 })
  public async portfolioSchedule(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    this.logger.log(this.i18n.t('logging.schedule.start'));

    const users = await this.getUsers();
    await this.tradeService.adjustPortfolios(users);

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
}
