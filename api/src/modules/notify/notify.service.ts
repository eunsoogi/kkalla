import { Injectable } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '../item/item.interface';
import { SequenceService } from '../sequence/sequence.service';
import { SlackService } from '../slack/slack.service';
import { User } from '../user/entities/user.entity';
import { Notify } from './entities/notify.entity';
import { NotifyData } from './notify.interface';

@Injectable()
export class NotifyService {
  constructor(
    private readonly sequenceService: SequenceService,
    private readonly slackService: SlackService,
    private readonly i18n: I18nService,
  ) {}

  public async findAll(user: User) {
    return Notify.findAllByUser(user);
  }

  public async create(user: User, data: NotifyData): Promise<Notify> {
    const notify = new Notify();

    Object.assign(notify, data);
    notify.seq = await this.sequenceService.getNextSequence();
    notify.user = user;

    // Send to slack
    this.slackService.send(user, { message: data?.message });

    return notify.save();
  }

  public clearClients(): void {
    this.slackService.clearClients();
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Notify>> {
    return Notify.paginate(user, request);
  }

  public async cursor(user: User, request: CursorRequest<string>): Promise<CursorItem<Notify, string>> {
    return Notify.cursor(user, request);
  }

  public async notify(user: User, message: string): Promise<Notify> {
    return this.create(user, { message });
  }

  /**
   * 서버용 발송 (시스템 오류 등 중요한 알림)
   * @param message 발송할 메시지
   */
  public async notifyServer(message: string): Promise<void> {
    // Send to slack
    this.slackService.sendServer({ message });
  }
}
