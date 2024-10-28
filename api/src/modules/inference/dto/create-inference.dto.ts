import { InferenceDicisionTypes } from '../inference.interface';

export class CreateInferenceDto {
  decision!: InferenceDicisionTypes;
  rate: number;
  reason?: string;
  reflection?: string;
}
