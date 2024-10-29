import { InferenceDicisionTypes } from '../inference.type';

export class CreateInferenceDto {
  decision!: InferenceDicisionTypes;
  rate: number;
  reason?: string;
  reflection?: string;
}
