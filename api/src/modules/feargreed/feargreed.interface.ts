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
  pairs: {
    date: string;
    code: string;
    currency: string;
    score: number;
    diff: number;
    stage: string;
  }[];
}

export interface CompactFeargreed {
  score: number;
  diff: number;
  stage: string;
}

export interface FeargreedApiResponse {
  at: string;
  today: {
    date: string;
    score: number;
    diff: number;
    cls_prc_ubmi: number;
    diff_ubmi: number;
    cls_prc_ubai: number;
    diff_ubai: number;
    stage: string;
    stage_en: string;
    comment: string;
  };
  series: {
    gf: [number, number][];
  };
  intv: {
    date: string;
    score: number;
    diff: number;
    name: string;
    stage: string;
    stage_en: string;
    comment: string;
  }[];
  pairs: {
    code: string;
    currency: string;
    korean_name: string;
    change_rate: number;
    cls_prc: number;
    score: number;
    stage: string;
    stage_en: string;
    date: string;
    updated_at: string;
  }[];
}
