import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  public async getServerClient() {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_SECRET_KEY,
    });

    return client;
  }
}
