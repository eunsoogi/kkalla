export interface LoungeRecord {
  id: string;
  title: string;
  content: string;
  contentRaw: {
    type: string;
    value: string;
    description: string;
  }[];
  isDisplay: boolean;
  publishAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoungeRequest {
  keyword: string;
  limit: number;
}

export interface LoungeApiResponse {
  keyword: string;
  limit: number;
  offset: number;
  total: number;
  ids: number[];
  records: LoungeRecord[];
}
