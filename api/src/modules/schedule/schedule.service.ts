import { Injectable } from '@nestjs/common';

import { User } from '@/modules/user/entities/user.entity';

import { Schedule } from './entities/schedule.entity';
import { ScheduleData } from './schedule.interface';

/**
 * 스케줄 관리 모듈의 핵심 서비스.
 *
 * - 사용자별 스케줄 설정을 관리한다.
 * - 스케줄 활성화된 사용자 목록을 조회한다.
 */
@Injectable()
export class ScheduleService {
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
