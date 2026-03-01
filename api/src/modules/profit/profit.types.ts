export interface ProfitData {
  /**
   * 사용자 이메일
   */
  email: string;

  /**
   * 전체 누적 수익
   */
  profit: number;

  /**
   * 오늘 기준 수익 (옵션)
   */
  todayProfit?: number;
}

export interface ProfitFilter {
  email?: string;
}
