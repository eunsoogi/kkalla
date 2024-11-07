import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';

import { NewsTypes } from '../news.enum';

export class GetNewsDto extends GetCursorDto<number> {
  type: NewsTypes = NewsTypes.COIN;
  limit: number = 10;
}
