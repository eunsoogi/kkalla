import { Injectable } from '@nestjs/common';

import { SlackService } from '../slack/slack.service';
import { User } from '../user/entities/user.entity';
import { Notify } from './entities/notify.entity';
import { NotifyData } from './notify.interface';

@Injectable()
export class NotifyService {
  constructor(private readonly slackService: SlackService) {}

  public async findAll(user: User) {
    return Notify.findAllByUser(user);
  }

  public async notify(user: User, message: string): Promise<Notify> {
    return this.create(user, { message });
  }

  public async create(user: User, data: NotifyData): Promise<Notify> {
    const notify = new Notify();

    notify.user = user;
    Object.assign(notify, data);

    // Send to slack
    this.slackService.send(user, { message: data?.message });

    return notify.save();
  }
}
