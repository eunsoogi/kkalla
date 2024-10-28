import { ApikeyTypes } from '../apikey.interface';

export class CreateApikeyDto {
  type!: ApikeyTypes;
  accessKey!: string;
  secretKey?: string;
}
