import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { ApikeyTypes } from './apikey.interface';
import { CreateApikeyDto } from './dto/create-apikey.dto';
import { UpdateApikeyDto } from './dto/update-apikey.dto';
import { Apikey } from './entities/apikey.entity';

@Injectable()
export class ApikeyService {
  async create(createApikeyDto: CreateApikeyDto): Promise<Apikey> {
    const existingApikey = await this.findByType(createApikeyDto.type);

    if (existingApikey) {
      throw new ConflictException('API key already exists.');
    }

    const apikey = new Apikey();

    apikey.type = createApikeyDto.type;
    apikey.apiKey = createApikeyDto.apiKey;
    apikey.secretKey = createApikeyDto.secretKey ?? '';

    await apikey.save();

    return apikey;
  }

  findAll() {
    return `This action returns all apikey`;
  }

  findOne(id: number) {
    return `This action returns a #${id} apikey`;
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

  update(id: number, updateApikeyDto: UpdateApikeyDto) {
    return `This action updates a #${id} apikey`;
  }

  remove(id: number) {
    return `This action removes a #${id} apikey`;
  }
}
