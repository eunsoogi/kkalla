import { Injectable } from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { ApikeyStatus } from './apikey.enum';
import { ApikeyData, ApikeyStatusRequest } from './apikey.interface';
import { Apikey } from './entities/apikey.entity';

@Injectable()
export class ApikeyService {
  public async status(user: User, data: ApikeyStatusRequest): Promise<ApikeyStatus> {
    const apikey = await Apikey.findByType(user, data.type);
    return apikey ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

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
