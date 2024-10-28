import { ApikeyTypes } from '../entities/apikey.entity';

export class CreateApikeyDto {
  type!: ApikeyTypes;
  apiKey!: string;
  secretKey?: string;
}
