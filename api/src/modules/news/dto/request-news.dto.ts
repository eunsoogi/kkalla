import { NewsTypes } from '../news.type';

export class RequestNewsDto {
  type?: NewsTypes = NewsTypes.COIN;
  limit?: number = 100;
}
