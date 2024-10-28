import { Inference } from '../entities/inference.entity';

export class PaginatedInferenceDto {
  items: Inference[];
  total: number = 0;
  page: number = 1;
  perPage: number;
  totalPages: number = 1;
}
