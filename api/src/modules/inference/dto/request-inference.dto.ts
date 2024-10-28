import { RequestDataDto } from '../../upbit/dto/request-data.dto';

export class RequestInferenceDto extends RequestDataDto {
  newsLimit: number = 100;
  inferenceLimit: number = 7;
}
