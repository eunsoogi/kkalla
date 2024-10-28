import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

import { ApikeyService } from '../apikey/apikey.service';
import { ApikeyTypes } from '../apikey/entities/apikey.entity';

@Injectable()
export class OpenaiService {
  constructor(private readonly apikeyService: ApikeyService) {}

  async getClient() {
    const apikey = await this.apikeyService.findByType(ApikeyTypes.OPENAI);

    const client = new OpenAI({
      apiKey: apikey?.apiKey,
    });

    return client;
  }
}
