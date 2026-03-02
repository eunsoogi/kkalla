export interface MinuteLookupCandidate {
  id: string;
  createdAt: Date;
}

export type MinuteLookupMode = 'exact' | 'mixed' | 'approx';
