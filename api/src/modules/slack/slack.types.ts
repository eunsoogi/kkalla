import { WebClient } from '@slack/web-api';

export interface SlackConfigData {
  token: string;
  channel: string;
}

export interface SlackMessage {
  message: string;
}

export interface SlackServerConfig {
  client: WebClient;
  channel: string;
}
