import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { User } from '../user/entities/user.entity';
import { OpenaiConfig } from './entities/openai-config.entity';
import { OpenaiConfigData } from './openai.interface';

@Injectable()
export class OpenaiService {
  public async readConfig(user: User): Promise<OpenaiConfig> {
    return OpenaiConfig.findByUser(user);
  }

  public async createConfig(user: User, data: OpenaiConfigData): Promise<OpenaiConfig> {
    let config = await this.readConfig(user);

    if (!config) {
      config = new OpenaiConfig();
    }

    config.user = user;
    Object.assign(config, data);

    return config.save();
  }

  public async status(user: User): Promise<ApikeyStatus> {
    const config = await this.readConfig(user);
    return config?.secretKey ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

  public async getClient(user: User) {
    const config = await this.readConfig(user);

    const client = new OpenAI({
      apiKey: config?.secretKey,
    });

    return client;
  }
}
