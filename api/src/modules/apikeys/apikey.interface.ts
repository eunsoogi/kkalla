import { ApikeyTypes } from './apikey.enum';

export interface ApikeyData {
  type: ApikeyTypes;
  accessKey: string;
  secretKey: string;
}
