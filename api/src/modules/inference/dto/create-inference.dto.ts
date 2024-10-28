import { InferenceDicisionTypes } from '../inference.interface';

export class CreateInferenceDto {
  decision!: InferenceDicisionTypes;
  krwBalance: number;
  coinBalance: number;
  suggestedBalance: number;
  reason?: string;
  reflection?: string;
}
