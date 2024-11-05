import { ApikeyTypes } from '../apikey.enum';

export class CreateApikeyDto {
  type: ApikeyTypes;
  accessKey: string;
  secretKey: string;
}
