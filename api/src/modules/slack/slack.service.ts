import { Injectable, Logger } from '@nestjs/common';

import { ChatPostMessageResponse, WebClient } from '@slack/web-api';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { User } from '../user/entities/user.entity';
import { SlackConfig } from './entities/slack-config.entity';
import { SlackConfigData, SlackMessage, SlackServerConfig } from './slack.types';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private serverClient: WebClient;
  private client: WebClient[] = [];
  private config: SlackConfig[] = [];

  constructor(private readonly i18n: I18nService) {}

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

  /**
   * 서버 슬랙 클라이언트 초기화
   * @returns SlackServerConfig 또는 null
   */
  private getServerClient(): SlackServerConfig | null {
    const serverToken = process.env.NOTIFY_SECRET_KEY;
    const serverChannel = process.env.NOTIFY_CHANNEL;

    // 서버 클라이언트 초기화 (캐싱)
    if (!this.serverClient) {
      this.serverClient = new WebClient(serverToken);
    }

    return { client: this.serverClient, channel: serverChannel };
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

  /**
   * 서버용 슬랙 발송 (환경변수에서 설정 읽기)
   * @param data 발송할 메시지 데이터
   * @returns ChatPostMessageResponse 또는 null
   */
  public async sendServer(data: SlackMessage): Promise<ChatPostMessageResponse> {
    const serverConfig = this.getServerClient();

    if (!serverConfig) {
      return null;
    }

    const result = await serverConfig.client.chat.postMessage({
      channel: serverConfig.channel,
      text: data.message,
    });

    return result;
  }
}
