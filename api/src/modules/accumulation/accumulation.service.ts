import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { RetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { PaginatedItem } from '../item/item.interface';
import { API_URL } from './accumulation.config';
import { Accumulation, AccumulationApiResponse } from './accumulation.interface';
import { GetAccumulationDto } from './dto/get-accumulation.dto';

@Injectable()
export class AccumulationService {
  private readonly logger = new Logger(AccumulationService.name);

  constructor(
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
  ) {}

  private getUrl(path: string): string {
    return `${API_URL}/${path}`;
  }

  private getSecretKey(): string {
    return Buffer.from(process.env.ACCUMULATION_SECRET_KEY!).toString('base64');
  }

  public async getAccumulations(
    request: GetAccumulationDto,
    retryOptions?: RetryOptions,
  ): Promise<PaginatedItem<Accumulation>> {
    const { data } = await this.errorService.retry(
      async () =>
        firstValueFrom(
          this.httpService.get<AccumulationApiResponse>(this.getUrl('api/v1/target'), {
            params: {
              ...request,
              order: `${request.order}$${request.sortDirection}`,
            },
            headers: {
              Authorization: `Bearer ${this.getSecretKey()}`,
            },
          }),
        ),
      retryOptions,
    );

    return this.toPaginatedAccumulation(request, data);
  }

  private toPaginatedAccumulation(
    request: GetAccumulationDto,
    response: AccumulationApiResponse,
  ): PaginatedItem<Accumulation> {
    return {
      total: Number(response.total),
      page: Math.ceil(request.start / request.display),
      perPage: Number(request.display),
      totalPages: Math.ceil(response.total / response.count),
      items: response.items.map((item) => ({
        market: item.market,
        symbol: item.symbol,
        avg: item.avg,
        price: item.price,
        priceRate: item.price_rate / 100,
        accTradePrice: item.acc_trade_price,
        strength: item.strength / 100,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    };
  }

  public async getAllAccumulations(request: GetAccumulationDto): Promise<Accumulation[]> {
    const display = await this.getAccumulationCount(request);

    const { items } = await this.getAccumulations({
      ...request,
      start: 1,
      display,
    });

    const filteredItems = items.filter(
      (item) =>
        (!request.priceRateLower || item.priceRate >= request.priceRateLower) &&
        (!request.priceRateUpper || item.priceRate <= request.priceRateUpper) &&
        (!request.accTradePriceLower || item.accTradePrice >= request.accTradePriceLower) &&
        (!request.accTradePriceUpper || item.accTradePrice <= request.accTradePriceUpper) &&
        (!request.strengthLower || item.strength >= request.strengthLower) &&
        (!request.strengthUpper || item.strength <= request.strengthUpper),
    );

    return request.display ? filteredItems.slice(0, request.display) : filteredItems;
  }

  private async getAccumulationCount(request: GetAccumulationDto): Promise<number> {
    const { total } = await this.getAccumulations({
      ...request,
      start: 1,
      display: 0,
    });

    return total;
  }
}
