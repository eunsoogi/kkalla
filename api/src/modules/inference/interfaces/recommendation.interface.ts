/**
 * 종목 추천 데이터 인터페이스
 */
export interface RecommendationItem {
  symbol: string;
  weight: number;
  confidence: number;
}

/**
 * GPT-5 추천 응답 인터페이스
 */
export interface RecommendationResponse {
  recommendations: RecommendationItem[];
  marketSummary: string;
  analysisDate: string;
}

/**
 * 추천 저장 요청 인터페이스
 */
export interface SaveRecommendationRequest {
  recommendations: RecommendationItem[];
  date: string;
}
