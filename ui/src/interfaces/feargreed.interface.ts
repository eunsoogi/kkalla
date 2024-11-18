export interface Feargreed {
  at: string;
  today: {
    date: string;
    score: number;
    diff: number;
    clsPrcUbmi: number;
    diffUbmi: number;
    clsPrcUbai: number;
    diffUbai: number;
    stage: string;
    comment: string;
  };
  intv: {
    date: string;
    score: number;
    diff: number;
    name: string;
    stage: string;
    comment: string;
  }[];
  pair: {
    date: string;
    code: string;
    koreanName: string;
    changeRate: number;
    clsPrc: number;
    score: number;
    stage: string;
  }[];
}
