import { Injectable } from '@nestjs/common';

import { ChatPostMessageResponse, WebClient } from '@slack/web-api';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { User } from '../user/entities/user.entity';
import { SlackConfig } from './entities/slack-config.entity';
import { SlackConfigData, SlackMessage } from './slack.interface';

@Injectable()
export class SlackService {
  private client: WebClient[] = [];
  private config: SlackConfig[] = [];

  public async readConfig(user: User): Promise<SlackConfig> {
    return SlackConfig.findByUser(user);
  }

  public async createConfig(user: User, data: SlackConfigData): Promise<SlackConfig> {
    let config = await this.readConfig(user);

    if (!config) {
      config = new SlackConfig();
    }

    config.user = user;
    Object.assign(config, data);

    this.clearClient(user);

    return config.save();
  }

  public async status(user: User): Promise<ApikeyStatus> {
    const config = await this.readConfig(user);
    return config?.token ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

  public async getClient(user: User): Promise<{ client: WebClient; config: SlackConfig }> {
    if (!this.client[user.id]) {
      this.config[user.id] = await this.readConfig(user);
      this.client[user.id] = new WebClient(this.config[user.id]?.token);
    }
    return { client: this.client[user.id], config: this.config[user.id] };
  }

  public clearClients(): void {
    this.client = [];
    this.config = [];
  }

  public clearClient(user: User): void {
    delete this.client[user.id];
    delete this.config[user.id];
  }

  public async send(user: User, data: SlackMessage): Promise<ChatPostMessageResponse> {
    const { client, config } = await this.getClient(user);

    if (!config?.channel) {
      return null;
    }

    const result = await client.chat.postMessage({
      channel: config.channel,
      text: data.message,
    });

    return result;
  }
}
