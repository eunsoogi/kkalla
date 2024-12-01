import { ApiProperty } from '@nestjs/swagger';

import { DecisionTypes } from '../../decision/decision.enum';

export class InferenceDto {
  @ApiProperty({
    example: DecisionTypes.BUY,
    enum: DecisionTypes,
  })
  decision?: DecisionTypes;

  @ApiProperty()
  reason?: string;

  @ApiProperty({
    example: 'BTC/KRW',
  })
  ticker?: string;
}
