import { ApikeyTypes } from './apikey.enum';

export interface ApikeyStatusRequest {
  type: ApikeyTypes;
}

export interface ApikeyData {
  type: ApikeyTypes;
  accessKey: string;
  secretKey: string;
}
