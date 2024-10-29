import { Injectable, NotFoundException } from '@nestjs/common';

import { ApikeyTypes } from './apikey.interface';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { Apikey } from './entities/apikey.entity';

@Injectable()
export class ApikeyService {
  async create(createApikeyDto: CreateApikeyDto): Promise<Apikey> {
    let apikey = await this.findByType(createApikeyDto.type);

    if (!apikey) {
      apikey = new Apikey();
    }

    Object.entries(createApikeyDto).forEach(([key, value]) => (apikey[key] = value));
    await apikey.save();

    return apikey;
  }

  async findByType(type: ApikeyTypes) {
    if (!type) {
      throw new NotFoundException('API key type is not set.');
    }

    return Apikey.findOne({
      where: {
        type: type,
      },
    });
  }
}
