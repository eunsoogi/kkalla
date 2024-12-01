import { SortDirection } from '../item/item.enum';
import { DecisionTypes } from './decision.enum';

export interface DecisionData {
  decision: DecisionTypes;
  orderRatio: number;
  weightLowerBound: number;
  weightUpperBound: number;
}

export interface DecisionFilter {
  users?: {
    id: string;
  };
  decision?: DecisionTypes;
  sortDirection?: SortDirection;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}
