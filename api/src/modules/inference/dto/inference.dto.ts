import { ApiProperty } from '@nestjs/swagger';

import { DecisionTypes } from '../../decision/decision.enum';

export class InferenceDto {
  @ApiProperty({
    example: 'BTC',
  })
  symbol?: string;

  @ApiProperty({
    example: DecisionTypes.BUY,
    enum: DecisionTypes,
  })
  decision?: DecisionTypes;
}
