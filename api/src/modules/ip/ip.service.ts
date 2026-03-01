import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { API_URL } from './ip.config';
import { IpResponse } from './ip.types';

@Injectable()
export class IpService {
  constructor(private readonly httpService: HttpService) {}

  public async getPublicIp(): Promise<string> {
    const { data } = await firstValueFrom(
      this.httpService.get<IpResponse>(API_URL, {
        params: {
          format: 'json',
        },
      }),
    );

    return data.ip;
  }
}
