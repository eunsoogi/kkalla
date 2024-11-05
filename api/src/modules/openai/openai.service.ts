import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

import { ApikeyTypes } from '../apikey/apikey.enum';
import { Apikey } from '../apikey/entities/apikey.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class OpenaiService {
  public async getClient(user: User) {
    const apikey = await Apikey.findByType(user, ApikeyTypes.OPENAI);

    const client = new OpenAI({
      apiKey: apikey?.secretKey,
    });

    return client;
  }
}
