import { ApikeyTypes } from '../apikey.interface';

export class CreateApikeyDto {
  type!: ApikeyTypes;
  apiKey!: string;
  secretKey?: string;
}
