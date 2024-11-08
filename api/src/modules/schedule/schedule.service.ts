import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PostTradeDto } from '../trade/dto/post-trade.dto';
import { Trade } from '../trade/entities/trade.entity';
import { TradeService } from '../trade/trade.service';
import { User } from '../user/entities/user.entity';
import { Schedule } from './entities/schedule.entity';
import { ScheduleData } from './schedule.interface';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly tradeService: TradeService) {}

  @Cron(CronExpression.EVERY_4_HOURS)
  public async tradeSchedule(): Promise<Trade[]> {
    this.logger.log('Trade schedule started...');

    const schedules = await Schedule.findByEnabled();
    const threads = schedules.map((schedule) => this.tradeService.trade(schedule.user, new PostTradeDto())); // TO-DO: dynamic symbol & market
    const results = await Promise.all(threads);

    this.logger.log('Trade schedule has ended.');

    return results;
  }

  public async create(user: User, data: ScheduleData): Promise<Schedule> {
    let schedule = await this.read(user);

    if (!schedule) {
      schedule = new Schedule();
    }

    schedule.user = user;
    Object.entries(data).forEach(([key, value]) => (schedule[key] = value));

    return schedule.save();
  }

  public async read(user: User): Promise<Schedule> {
    return Schedule.findByUser(user);
  }
}
