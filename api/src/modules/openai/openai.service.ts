import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

import { ApikeyService } from '../apikey/apikey.service';
import { ApikeyTypes } from '../apikey/apikey.type';

@Injectable()
export class OpenaiService {
  constructor(private readonly apikeyService: ApikeyService) {}

  public async getClient() {
    const apikey = await this.apikeyService.findByType(ApikeyTypes.OPENAI);

    const client = new OpenAI({
      apiKey: apikey?.secretKey,
    });

    return client;
  }
}
