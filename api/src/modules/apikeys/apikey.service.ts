import { Injectable } from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { Apikey } from './entities/apikey.entity';

@Injectable()
export class ApikeyService {
  public async create(user: User, createApikeyDto: CreateApikeyDto): Promise<Apikey> {
    let apikey = await Apikey.findByType(user, createApikeyDto.type);

    if (!apikey) {
      apikey = new Apikey();
    }

    apikey.user = user;
    Object.entries(createApikeyDto).forEach(([key, value]) => (apikey[key] = value));

    return apikey.save();
  }
}
