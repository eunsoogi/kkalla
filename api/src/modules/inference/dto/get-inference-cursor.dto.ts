import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToBoolean } from '@/transforms/boolean.transform';

export class GetInferenceCursorDto extends GetCursorDto<string> {
  @ToBoolean()
  @ApiProperty()
  mine: boolean = false;
}
