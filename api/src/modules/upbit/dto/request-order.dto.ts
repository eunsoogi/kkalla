import { OrderTypes } from '../upbit.enum';

export class RequestOrderDto {
  symbol: string;
  market: string;
  type: OrderTypes;
  rate: number;
}
