/**
 * 마켓 feature 추출 요청 인터페이스
 */
export interface ExtractFeaturesRequest {
  symbols: string[];
}

/**
 * feature 추출 응답 인터페이스
 */
export interface ExtractFeaturesResponse {
  features: any[]; // MarketFeatures[]
  extractedCount: number;
  timestamp: string;
}
