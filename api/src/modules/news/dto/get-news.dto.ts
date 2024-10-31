import { NewsTypes } from '../news.enum';

export class GetNewsDto {
  type: NewsTypes = NewsTypes.COIN;
  limit: number = 100;
}
