import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';

import { ApikeyTypes } from '../apikeys/apikey.enum';
import { Apikey } from '../apikeys/entities/apikey.entity';
import { User } from '../users/entities/user.entity';

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
