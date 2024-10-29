import { ApikeyTypes } from '../apikey.type';

export class CreateApikeyDto {
  type!: ApikeyTypes;
  accessKey!: string;
  secretKey?: string;
}
