import { NewsTypes } from '../news.interface';

export class RequestNewsDto {
  type?: NewsTypes = NewsTypes.COIN;
  limit?: number = 100;
}
