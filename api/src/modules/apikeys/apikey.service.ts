import { Injectable } from '@nestjs/common';

import { User } from '../users/entities/user.entity';
import { ApikeyData } from './apikey.interface';
import { Apikey } from './entities/apikey.entity';

@Injectable()
export class ApikeyService {
  public async create(user: User, data: ApikeyData): Promise<Apikey> {
    let apikey = await Apikey.findByType(user, data.type);

    if (!apikey) {
      apikey = new Apikey();
    }

    apikey.user = user;
    Object.entries(data).forEach(([key, value]) => (apikey[key] = value));

    return apikey.save();
  }
}
