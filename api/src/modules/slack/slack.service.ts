import { Injectable } from '@nestjs/common';

import { ChatPostMessageResponse, WebClient } from '@slack/web-api';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { User } from '../user/entities/user.entity';
import { SlackConfig } from './entities/slack-config.entity';
import { SlackConfigData, SlackMessage } from './slack.interface';

@Injectable()
export class SlackService {
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

    return config.save();
  }

  public async status(user: User): Promise<ApikeyStatus> {
    const config = await this.readConfig(user);
    return config?.token ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

  public async getClient(user: User): Promise<{ client: WebClient; config: SlackConfig }> {
    const config = await this.readConfig(user);
    const client = new WebClient(config?.token);

    return { client, config };
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
