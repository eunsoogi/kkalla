import { Injectable, Logger } from '@nestjs/common';

import * as Handlebars from 'handlebars';
import { I18nService } from 'nestjs-i18n';

import { ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG } from '@/modules/allocation-core/allocation-recommendation.prompt.shared';
import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { MarketFeatures } from '@/modules/upbit/upbit.types';
import { formatObjectNumbers } from '@/utils/number';

@Injectable()
export class FeatureService {
  private readonly logger = new Logger(FeatureService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly upbitService: UpbitService,
  ) {}

  /**
   * Upbit 특정 종목의 기술적 지표 feature 추출
   */
  public async extractMarketFeatures(symbol: string): Promise<MarketFeatures | null> {
    this.logger.log(this.i18n.t('logging.upbit.features.startOne', { args: { symbol } }));

    try {
      const marketData = await this.upbitService.getMarketData(symbol);
      const { ticker, candles1d, candles1w } = marketData;

      // 가격 데이터 추출
      const prices1d = candles1d.map((candle) => candle[4]);
      const prices1w = candles1w ? candles1w.map((candle) => candle[4]) : prices1d;

      // OHLCV 데이터 추출
      const highs1d = candles1d.map((candle) => candle[2]);
      const lows1d = candles1d.map((candle) => candle[3]);
      const volumes1d = candles1d.map((candle) => candle[5]);

      const baseAsset = symbol.split('/')[0];
      const currentPrice = ticker?.last || ticker?.close || 0;

      // 기본 정보
      const priceChange24h = ticker?.change || 0;
      const priceChangePercent24h = ticker?.percentage || 0;
      const volume24h = ticker?.baseVolume || 0;
      const quoteVolume24h = ticker?.quoteVolume || 0;

      // RSI 지표들
      const rsi14 = this.calculateRSI(prices1d, 14);
      const rsi9 = this.calculateRSI(prices1d, 9);
      const rsi21 = this.calculateRSI(prices1d, 21);

      // MACD 지표
      const macd = this.calculateMACD(prices1d, 12, 26, 9);

      // 이동평균들 (SMA)
      const sma5 = this.calculateSMA(prices1d, 5);
      const sma10 = this.calculateSMA(prices1d, 10);
      const sma20 = this.calculateSMA(prices1d, 20);
      const sma50 = this.calculateSMA(prices1d, 50);
      const sma100 = this.calculateSMA(prices1d, 100);
      const sma200 = this.calculateSMA(prices1d, 200);

      // 지수이동평균들 (EMA)
      const ema5 = this.calculateEMA(prices1d, 5);
      const ema10 = this.calculateEMA(prices1d, 10);
      const ema12 = this.calculateEMA(prices1d, 12);
      const ema20 = this.calculateEMA(prices1d, 20);
      const ema26 = this.calculateEMA(prices1d, 26);
      const ema50 = this.calculateEMA(prices1d, 50);
      const ema100 = this.calculateEMA(prices1d, 100);
      const ema200 = this.calculateEMA(prices1d, 200);

      // Bollinger Bands
      const bollingerBands = this.calculateBollingerBands(prices1d, 20, 2);

      // Stochastic Oscillator
      const stochastic = this.calculateStochastic(highs1d, lows1d, prices1d, 14, 3);

      // Williams %R
      const williamsR = this.calculateWilliamsR(highs1d, lows1d, prices1d, 14);

      // ATR (Average True Range)
      const atr = this.calculateATR(highs1d, lows1d, prices1d, 14);

      // VWAP
      const vwap = this.calculateVWAP(candles1d.slice(-20)); // 최근 20일

      // OBV
      const obv = this.calculateOBV(candles1d);

      // CCI
      const cci = this.calculateCCI(candles1d, 20);

      // MFI
      const mfi = this.calculateMFI(candles1d, 14);

      // 변동성과 모멘텀
      const volatility = this.calculateVolatility(prices1d.slice(-20));
      const momentum = this.calculateMomentum(prices1d, 5);

      // 유동성 점수
      const avgVolume = volumes1d.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volumes1d.length, 20);
      const liquidityScore = Math.min(avgVolume / 1000000, 10);

      // 52주 고점 대비 현재 위치
      const pricePosition =
        prices1w.length > 0
          ? (currentPrice - Math.min(...prices1w)) / (Math.max(...prices1w) - Math.min(...prices1w))
          : 0.5;

      // 평균 대비 현재 거래량 비율
      const volumeRatio = avgVolume > 0 ? (volumes1d[volumes1d.length - 1] || 0) / avgVolume : 1;

      // 지지/저항 레벨
      const supportResistance = this.calculateSupportResistance(candles1d);

      // 패턴 분석
      const patterns = this.analyzePatterns(candles1d, prices1d);

      // 예측 관련 지표 계산
      const prediction = this.calculatePredictionIndicators(
        candles1d,
        prices1d,
        volumes1d,
        currentPrice,
        patterns,
        supportResistance,
      );

      const features: MarketFeatures = {
        symbol,
        baseAsset,
        price: currentPrice,
        priceChange24h,
        priceChangePercent24h,
        volume24h,
        quoteVolume24h,

        // RSI 지표들
        rsi14,
        rsi9,
        rsi21,

        // MACD
        macd,

        // 이동평균들
        sma: {
          sma5,
          sma10,
          sma20,
          sma50,
          sma100,
          sma200,
        },
        ema: {
          ema5,
          ema10,
          ema12,
          ema20,
          ema26,
          ema50,
          ema100,
          ema200,
        },

        // 기타 지표들
        bollingerBands,
        stochastic,
        williamsR,
        atr,
        vwap,
        obv,
        cci,
        mfi,

        // 추가 지표들
        volatility,
        momentum,
        liquidityScore,
        pricePosition,
        volumeRatio,
        supportResistance,
        patterns,
        prediction,
      };

      // 모든 숫자 값의 소수점 부분을 유효숫자 3자리로 포맷팅 (정수는 그대로 유지)
      const formattedFeatures = formatObjectNumbers(features, 3) as MarketFeatures;

      // 이전 배치들의 intensity 변동성 계산 및 추가
      const recentRecommendations = await this.fetchRecentRecommendations(symbol);
      if (recentRecommendations.length > 0) {
        const previousIntensities = recentRecommendations.map((rec) => rec.intensity);

        // intensity 변동성 계산
        const intensityVolatility = await this.calculateIntensityVolatility(previousIntensities);
        if (intensityVolatility) {
          formattedFeatures.intensityVolatility = intensityVolatility;
        }
      }

      this.logger.log(this.i18n.t('logging.upbit.features.successOne', { args: { symbol } }));
      return formattedFeatures;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.features.failedOne', { args: { symbol } }), error);
      return null;
    }
  }

  /**
   * 모든 KRW 마켓 종목의 feature 추출
   */
  public async extractAllKrwMarketFeatures(symbols?: string[]): Promise<MarketFeatures[]> {
    this.logger.log(
      this.i18n.t('logging.upbit.features.startAll', {
        args: { count: symbols ? symbols.length : 'all KRW' },
      }),
    );

    try {
      let targetSymbols: string[];

      if (symbols && symbols.length > 0) {
        targetSymbols = symbols;
      } else {
        const serverClient = await this.upbitService.getServerClient();
        const markets = await serverClient.fetchMarkets();
        targetSymbols = markets
          .filter((market) => market.id.startsWith('KRW-'))
          .map((market) => market.id.replace('KRW-', '') + '/KRW');
      }

      const results: MarketFeatures[] = [];

      for (const symbol of targetSymbols) {
        try {
          const features = await this.extractMarketFeatures(symbol);
          if (features) {
            results.push(features);
          }
        } catch (error) {
          this.logger.warn(this.i18n.t('logging.upbit.features.extractFailed', { args: { symbol } }), error);
        }
      }

      this.logger.log(this.i18n.t('logging.upbit.features.successAll', { args: { count: results.length } }));
      return results;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.features.failedAll'), error);
      throw error;
    }
  }

  /**
   * RSI(14) 계산
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // 기본값

    let gains = 0;
    let losses = 0;

    // 첫 번째 기간의 평균 계산
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // 나머지 기간에 대해 지수 이동평균 계산
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * 단순 이동평균(SMA) 계산
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * 지수 이동평균(EMA) 계산
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  /**
   * EMA 배열 계산 (각 시점의 EMA 값들)
   */
  private calculateEMAArray(prices: number[], period: number): number[] {
    if (prices.length === 0) return [];

    const multiplier = 2 / (period + 1);
    const emas: number[] = [];

    // 첫 번째 EMA는 SMA로 시작
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emas.push(ema);

    // 나머지 EMA 계산
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
      emas.push(ema);
    }

    return emas;
  }

  /**
   * 변동성 계산 (표준편차)
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map((price) => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    return Math.sqrt(variance) / mean; // 정규화된 변동성
  }

  /**
   * 모멘텀 계산 (최근 가격 변화율)
   */
  private calculateMomentum(prices: number[], period: number = 5): number {
    if (prices.length < period + 1) return 0;

    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - period - 1];
    return (currentPrice - pastPrice) / pastPrice;
  }

  /**
   * MACD 계산
   */
  private calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    if (prices.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const fastEMA = this.calculateEMAArray(prices, fastPeriod);
    const slowEMA = this.calculateEMAArray(prices, slowPeriod);

    // MACD Line = Fast EMA - Slow EMA
    const macdLine: number[] = [];
    const startIndex = slowPeriod - fastPeriod;

    for (let i = startIndex; i < fastEMA.length; i++) {
      const slowIndex = i - startIndex;
      if (slowIndex < slowEMA.length) {
        macdLine.push(fastEMA[i] - slowEMA[slowIndex]);
      }
    }

    // Signal Line = EMA of MACD Line
    const signalLine = this.calculateEMAArray(macdLine, signalPeriod);

    const currentMACD = macdLine[macdLine.length - 1] || 0;
    const currentSignal = signalLine[signalLine.length - 1] || 0;
    const histogram = currentMACD - currentSignal;

    return {
      macd: currentMACD,
      signal: currentSignal,
      histogram: histogram,
    };
  }

  /**
   * Bollinger Bands 계산
   */
  private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    if (prices.length < period) {
      const price = prices[prices.length - 1] || 0;
      return {
        upper: price,
        middle: price,
        lower: price,
        bandwidth: 0,
        percentB: 0.5,
      };
    }

    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);

    // 표준편차 계산
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = sma + standardDeviation * stdDev;
    const lower = sma - standardDeviation * stdDev;
    const currentPrice = prices[prices.length - 1];

    // %B = (현재가 - Lower Band) / (Upper Band - Lower Band)
    const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

    // Bandwidth = (Upper Band - Lower Band) / Middle Band
    const bandwidth = sma !== 0 ? (upper - lower) / sma : 0;

    return {
      upper,
      middle: sma,
      lower,
      bandwidth,
      percentB,
    };
  }

  /**
   * Stochastic Oscillator 계산
   */
  private calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    kPeriod: number = 14,
    dPeriod: number = 3,
  ) {
    if (closes.length < kPeriod) {
      return { percentK: 50, percentD: 50, slowK: 50, slowD: 50 };
    }

    const kValues: number[] = [];

    // %K 계산
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const recentHighs = highs.slice(i - kPeriod + 1, i + 1);
      const recentLows = lows.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);

      const k = highestHigh !== lowestLow ? ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100 : 50;
      kValues.push(k);
    }

    // %D = %K의 3일 이동평균
    const dValues: number[] = [];
    for (let i = dPeriod - 1; i < kValues.length; i++) {
      const sum = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
      dValues.push(sum / dPeriod);
    }

    const currentK = kValues[kValues.length - 1] || 50;
    const currentD = dValues[dValues.length - 1] || 50;

    // Slow Stochastic
    const slowK = currentD; // Slow %K = Fast %D
    const slowD = dValues.length >= 3 ? dValues.slice(-3).reduce((a, b) => a + b, 0) / 3 : currentD;

    return {
      percentK: currentK,
      percentD: currentD,
      slowK,
      slowD,
    };
  }

  /**
   * Williams %R 계산
   */
  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length < period) return -50;

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    if (highestHigh === lowestLow) return -50;

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  /**
   * ATR (Average True Range) 계산
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14) {
    if (closes.length < 2) {
      return { atr14: 0, atr21: 0, normalizedATR: 0 };
    }

    const trueRanges: number[] = [];

    // True Range 계산
    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    const atr14 =
      period <= trueRanges.length
        ? this.calculateSMA(trueRanges, period)
        : trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;

    const atr21 = 21 <= trueRanges.length ? this.calculateSMA(trueRanges, 21) : atr14;

    const currentPrice = closes[closes.length - 1];
    const normalizedATR = currentPrice !== 0 ? (atr14 / currentPrice) * 100 : 0;

    return { atr14, atr21, normalizedATR };
  }

  /**
   * VWAP (Volume Weighted Average Price) 계산
   */
  private calculateVWAP(candles: any[]): number {
    if (candles.length === 0) return 0;

    let totalVolume = 0;
    let totalPriceVolume = 0;

    for (const candle of candles) {
      const [, , high, low, close, volume] = candle;
      const typicalPrice = (high + low + close) / 3;
      const priceVolume = typicalPrice * volume;

      totalPriceVolume += priceVolume;
      totalVolume += volume;
    }

    return totalVolume !== 0 ? totalPriceVolume / totalVolume : 0;
  }

  /**
   * OBV (On Balance Volume) 계산
   */
  private calculateOBV(candles: any[]) {
    if (candles.length < 2) {
      return { current: 0, trend: 0, signal: 'neutral' as const };
    }

    let obv = 0;
    const obvValues: number[] = [0]; // 첫 번째 값은 0으로 시작

    for (let i = 1; i < candles.length; i++) {
      const [, , , , currentClose, currentVolume] = candles[i];
      const [, , , , prevClose] = candles[i - 1];

      if (currentClose > prevClose) {
        obv += currentVolume;
      } else if (currentClose < prevClose) {
        obv -= currentVolume;
      }
      // 가격이 같으면 OBV 변화 없음

      obvValues.push(obv);
    }

    // OBV 트렌드 계산 (최근 5개 값의 기울기)
    let trend = 0;
    if (obvValues.length >= 5) {
      const recentOBV = obvValues.slice(-5);
      const x = [1, 2, 3, 4, 5];
      const n = 5;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = recentOBV.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * recentOBV[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

      trend = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    // 신호 분류
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (trend > 0.1) signal = 'bullish';
    else if (trend < -0.1) signal = 'bearish';

    return {
      current: obv,
      trend,
      signal,
    };
  }

  /**
   * CCI (Commodity Channel Index) 계산
   */
  private calculateCCI(candles: any[], period: number = 20): number {
    if (candles.length < period) return 0;

    const recentCandles = candles.slice(-period);
    const typicalPrices = recentCandles.map((candle) => {
      const [, , high, low, close] = candle;
      return (high + low + close) / 3;
    });

    const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const currentTP = typicalPrices[typicalPrices.length - 1];

    // Mean Deviation 계산
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;

    if (meanDeviation === 0) return 0;

    return (currentTP - smaTP) / (0.015 * meanDeviation);
  }

  /**
   * MFI (Money Flow Index) 계산
   */
  private calculateMFI(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 50;

    const recentCandles = candles.slice(-(period + 1));
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i < recentCandles.length; i++) {
      const [, , high, low, close, volume] = recentCandles[i];
      const [, , , , prevClose] = recentCandles[i - 1];

      const typicalPrice = (high + low + close) / 3;
      const rawMoneyFlow = typicalPrice * volume;

      if (close > prevClose) {
        positiveFlow += rawMoneyFlow;
      } else if (close < prevClose) {
        negativeFlow += rawMoneyFlow;
      }
    }

    if (negativeFlow === 0) return 100;
    if (positiveFlow === 0) return 0;

    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - 100 / (1 + moneyFlowRatio);
  }

  /**
   * 지지/저항 레벨 계산
   */
  private calculateSupportResistance(candles: any[]) {
    if (candles.length < 20) {
      const price = candles[candles.length - 1]?.[4] || 0;
      return {
        support1: price * 0.95,
        support2: price * 0.9,
        resistance1: price * 1.05,
        resistance2: price * 1.1,
      };
    }

    const prices = candles.map((candle) => candle[4]); // close prices
    const highs = candles.map((candle) => candle[2]); // high prices
    const lows = candles.map((candle) => candle[3]); // low prices

    // 최근 고점/저점 찾기
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    const currentPrice = prices[prices.length - 1];

    // 피벗 포인트 기반 계산
    const pivot = (recentHigh + recentLow + currentPrice) / 3;

    return {
      support1: pivot - (recentHigh - recentLow) * 0.382, // 38.2% 되돌림
      support2: pivot - (recentHigh - recentLow) * 0.618, // 61.8% 되돌림
      resistance1: pivot + (recentHigh - recentLow) * 0.382,
      resistance2: pivot + (recentHigh - recentLow) * 0.618,
    };
  }

  /**
   * 패턴 분석
   */
  private analyzePatterns(candles: any[], prices: number[]) {
    if (prices.length < 20) {
      return {
        trend: 'sideways' as const,
        strength: 50,
        divergence: 'none' as const,
      };
    }

    // 추세 강도 계산 (20일 이동평균 기울기 기반)
    const ma20Array: number[] = [];
    for (let i = 19; i < prices.length; i++) {
      ma20Array.push(this.calculateSMA(prices.slice(i - 19, i + 1), 20));
    }

    const recentMA = ma20Array.slice(-10);
    let trendStrength = 0;

    if (recentMA.length >= 2) {
      const trendSlope = (recentMA[recentMA.length - 1] - recentMA[0]) / recentMA[0];
      trendStrength = Math.min(Math.abs(trendSlope) * 1000, 100);
    }

    // 추세 방향 결정
    const currentPrice = prices[prices.length - 1];
    const ma20 = this.calculateSMA(prices, 20);
    const ma50 = prices.length >= 50 ? this.calculateSMA(prices, 50) : ma20;

    let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    if (currentPrice > ma20 && ma20 > ma50 && trendStrength > 30) {
      trend = 'uptrend';
    } else if (currentPrice < ma20 && ma20 < ma50 && trendStrength > 30) {
      trend = 'downtrend';
    }

    // 다이버전스 감지 (간단한 버전)
    let divergence: 'bullish' | 'bearish' | 'none' = 'none';
    if (prices.length >= 50) {
      const recentPrices = prices.slice(-20);
      const recentRSI = this.calculateRSI(recentPrices, 14);

      if (trend === 'downtrend' && recentRSI > 30) {
        divergence = 'bullish';
      } else if (trend === 'uptrend' && recentRSI < 70) {
        divergence = 'bearish';
      }
    }

    return {
      trend,
      strength: trendStrength,
      divergence,
    };
  }

  /**
   * 예측 관련 지표 계산
   */
  private calculatePredictionIndicators(
    candles: any[],
    prices: number[],
    volumes: number[],
    currentPrice: number,
    patterns: { trend: string; strength: number; divergence: string },
    supportResistance: { support1: number; support2: number; resistance1: number; resistance2: number },
  ) {
    if (prices.length < 10 || volumes.length < 10) {
      return {
        trendPersistence: 50,
        priceAcceleration: 0,
        volumeAcceleration: 0,
        confidence: 50,
        momentumStrength: 50,
      };
    }

    // 1. 추세 지속성 점수 계산
    const trendPersistence = this.calculateTrendPersistence(prices, patterns);

    // 2. 가격 가속도 계산
    const priceAcceleration = this.calculatePriceAcceleration(prices);

    // 3. 거래량 가속도 계산
    const volumeAcceleration = this.calculateVolumeAcceleration(volumes);

    // 4. 모멘텀 강도 계산
    const momentumStrength = this.calculateMomentumStrength(prices, volumes, patterns);

    // 5. 예측 신뢰도 점수 계산
    const confidence = this.calculatePredictionConfidence(prices, volumes, patterns, supportResistance, currentPrice);

    // 6. 가격 목표 레벨 계산
    const priceTargets = this.calculatePriceTargets(currentPrice, supportResistance, patterns, priceAcceleration);

    return {
      trendPersistence,
      priceAcceleration,
      volumeAcceleration,
      confidence,
      priceTargets,
      momentumStrength,
    };
  }

  /**
   * 추세 지속성 점수 계산 (0-100)
   */
  private calculateTrendPersistence(
    prices: number[],
    patterns: { trend: string; strength: number; divergence: string },
  ): number {
    if (prices.length < 20) return 50;

    // 최근 20일간의 가격 변화 방향 일치도 계산
    const recentPrices = prices.slice(-20);
    const priceChanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      priceChanges.push(recentPrices[i] - recentPrices[i - 1]);
    }

    // 추세 방향 일치도: 같은 방향으로 움직인 비율
    const trend = patterns.trend;
    let consistentMoves = 0;
    if (trend === 'uptrend') {
      consistentMoves = priceChanges.filter((change) => change > 0).length;
    } else if (trend === 'downtrend') {
      consistentMoves = priceChanges.filter((change) => change < 0).length;
    } else {
      // 횡보: 변화가 작은 비율
      const avgChange = Math.abs(priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length);
      const smallChanges = priceChanges.filter((change) => Math.abs(change) < avgChange * 0.5).length;
      consistentMoves = smallChanges;
    }

    const consistency = (consistentMoves / priceChanges.length) * 100;
    const strengthFactor = patterns.strength / 100;

    // 추세 지속성 = 일치도 * 추세 강도
    return Math.min(consistency * strengthFactor, 100);
  }

  /**
   * 가격 가속도 계산
   */
  private calculatePriceAcceleration(prices: number[]): number {
    if (prices.length < 10) return 0;

    const recentPrices = prices.slice(-10);
    const velocities: number[] = [];
    const accelerations: number[] = [];

    // 속도 계산 (가격 변화율)
    for (let i = 1; i < recentPrices.length; i++) {
      const velocity = (recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1];
      velocities.push(velocity);
    }

    // 가속도 계산 (속도 변화율)
    for (let i = 1; i < velocities.length; i++) {
      const acceleration = velocities[i] - velocities[i - 1];
      accelerations.push(acceleration);
    }

    // 평균 가속도 반환 (정규화)
    const avgAcceleration = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    return avgAcceleration * 10000; // 10000배 스케일링
  }

  /**
   * 거래량 가속도 계산
   */
  private calculateVolumeAcceleration(volumes: number[]): number {
    if (volumes.length < 10) return 0;

    const recentVolumes = volumes.slice(-10);
    const volumeChanges: number[] = [];

    // 거래량 변화율 계산
    for (let i = 1; i < recentVolumes.length; i++) {
      if (recentVolumes[i - 1] > 0) {
        const change = (recentVolumes[i] - recentVolumes[i - 1]) / recentVolumes[i - 1];
        volumeChanges.push(change);
      }
    }

    if (volumeChanges.length < 2) return 0;

    // 가속도 계산 (변화율의 변화)
    const accelerations: number[] = [];
    for (let i = 1; i < volumeChanges.length; i++) {
      accelerations.push(volumeChanges[i] - volumeChanges[i - 1]);
    }

    // 평균 가속도 반환
    return accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
  }

  /**
   * 모멘텀 강도 계산 (0-100)
   */
  private calculateMomentumStrength(
    prices: number[],
    volumes: number[],
    patterns: { trend: string; strength: number; divergence: string },
  ): number {
    if (prices.length < 10) return 50;

    // 가격 모멘텀
    const recentPrices = prices.slice(-10);
    const priceMomentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];

    // 거래량 모멘텀
    const recentVolumes = volumes.slice(-10);
    const avgVolume = recentVolumes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const recentAvgVolume = recentVolumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeMomentum = avgVolume > 0 ? (recentAvgVolume - avgVolume) / avgVolume : 0;

    // 추세 강도
    const trendStrength = patterns.strength;

    // 모멘텀 강도 = (가격 모멘텀 + 거래량 모멘텀 + 추세 강도) / 3
    const priceMomentumScore = Math.min(Math.abs(priceMomentum) * 1000, 100);
    const volumeMomentumScore = Math.min(Math.abs(volumeMomentum) * 100, 100);

    return priceMomentumScore * 0.4 + volumeMomentumScore * 0.3 + trendStrength * 0.3;
  }

  /**
   * 예측 신뢰도 점수 계산 (0-100)
   */
  private calculatePredictionConfidence(
    prices: number[],
    volumes: number[],
    patterns: { trend: string; strength: number; divergence: string },
    supportResistance: { support1: number; support2: number; resistance1: number; resistance2: number },
    currentPrice: number,
  ): number {
    let confidence = 50; // 기본값

    // 1. 지표 일치도 (30%)
    const indicatorAgreement = this.calculateIndicatorAgreement(prices, volumes, patterns);
    confidence += indicatorAgreement * 0.3;

    // 2. 지지/저항 근접도 (20%)
    const supportResistanceProximity = this.calculateSupportResistanceProximity(currentPrice, supportResistance);
    confidence += supportResistanceProximity * 0.2;

    // 3. 거래량 확인 (25%)
    const volumeConfirmation = this.calculateVolumeConfirmation(prices, volumes);
    confidence += volumeConfirmation * 0.25;

    // 4. 추세 강도 (25%)
    confidence += (patterns.strength / 100) * 25;

    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * 지표 일치도 계산
   */
  private calculateIndicatorAgreement(
    prices: number[],
    volumes: number[],
    patterns: { trend: string; strength: number; divergence: string },
  ): number {
    if (prices.length < 20) return 50;

    const recentPrices = prices.slice(-20);
    const rsi = this.calculateRSI(recentPrices, 14);
    const macd = this.calculateMACD(recentPrices, 12, 26, 9);

    let agreement = 0;
    let count = 0;

    // RSI와 추세 일치도
    if (patterns.trend === 'uptrend' && rsi > 50) {
      agreement += 1;
    } else if (patterns.trend === 'downtrend' && rsi < 50) {
      agreement += 1;
    }
    count++;

    // MACD와 추세 일치도
    if (patterns.trend === 'uptrend' && macd.macd > macd.signal) {
      agreement += 1;
    } else if (patterns.trend === 'downtrend' && macd.macd < macd.signal) {
      agreement += 1;
    }
    count++;

    // 다이버전스 확인
    if (patterns.divergence !== 'none') {
      agreement += 0.5; // 다이버전스는 추가 신호
    }
    count += 0.5;

    return (agreement / count) * 100;
  }

  /**
   * 지지/저항 근접도 계산
   */
  private calculateSupportResistanceProximity(
    currentPrice: number,
    supportResistance: { support1: number; support2: number; resistance1: number; resistance2: number },
  ): number {
    // 현재 가격이 지지선이나 저항선에 가까울수록 신뢰도 높음
    const distances = [
      Math.abs(currentPrice - supportResistance.support1) / currentPrice,
      Math.abs(currentPrice - supportResistance.support2) / currentPrice,
      Math.abs(currentPrice - supportResistance.resistance1) / currentPrice,
      Math.abs(currentPrice - supportResistance.resistance2) / currentPrice,
    ];

    const minDistance = Math.min(...distances);
    // 5% 이내에 있으면 높은 신뢰도
    if (minDistance < 0.05) return 100;
    // 10% 이내에 있으면 중간 신뢰도
    if (minDistance < 0.1) return 70;
    // 그 외는 낮은 신뢰도
    return 30;
  }

  /**
   * 거래량 확인 계산
   */
  private calculateVolumeConfirmation(prices: number[], volumes: number[]): number {
    if (prices.length < 10 || volumes.length < 10) return 50;

    const recentPrices = prices.slice(-10);
    const recentVolumes = volumes.slice(-10);

    // 가격 상승 시 거래량 증가 확인
    let confirmations = 0;
    for (let i = 1; i < recentPrices.length; i++) {
      const priceChange = recentPrices[i] - recentPrices[i - 1];
      const volumeChange = recentVolumes[i] - recentVolumes[i - 1];

      if ((priceChange > 0 && volumeChange > 0) || (priceChange < 0 && volumeChange < 0)) {
        confirmations++;
      }
    }

    return (confirmations / (recentPrices.length - 1)) * 100;
  }

  /**
   * 가격 목표 레벨 계산
   */
  private calculatePriceTargets(
    currentPrice: number,
    supportResistance: { support1: number; support2: number; resistance1: number; resistance2: number },
    patterns: { trend: string; strength: number; divergence: string },
    priceAcceleration: number,
  ): { bullish: number; bearish: number; neutral: number } {
    // 기본 목표가: 지지/저항선 기반
    let bullish = supportResistance.resistance1;
    let bearish = supportResistance.support1;
    let neutral = currentPrice;

    // 추세와 가속도에 따라 조정
    if (patterns.trend === 'uptrend' && priceAcceleration > 0) {
      // 상승 추세 + 가속도 → 더 높은 목표가
      bullish = supportResistance.resistance2 || supportResistance.resistance1 * 1.1;
      neutral = (currentPrice + bullish) / 2;
    } else if (patterns.trend === 'downtrend' && priceAcceleration < 0) {
      // 하락 추세 + 감속 → 더 낮은 목표가
      bearish = supportResistance.support2 || supportResistance.support1 * 0.9;
      neutral = (currentPrice + bearish) / 2;
    }

    return { bullish, bearish, neutral };
  }

  /**
   * 이전 배치들의 intensity 변동성 및 시장 feature 변화 계산
   *
   * - 이전 배치들의 intensity 데이터를 기반으로 변동성 지표를 계산합니다.
   * - 이전 배치 시점의 시장 feature와 현재 시장 feature를 비교하여 변화를 계산합니다.
   * - 5%p 차이 감지를 위해 사용됩니다.
   *
   * @param previousIntensities 이전 배치들의 intensity 배열 (최신순)
   * @param previousBatchTime 이전 배치 시점 (밀리초 타임스탬프, 선택적)
   * @param currentFeatures 현재 시장 feature (선택적)
   * @param symbol 종목 심볼 (선택적)
   * @returns intensity 변동성 지표 및 시장 feature 변화
   */
  public async calculateIntensityVolatility(
    previousIntensities: number[],
  ): Promise<MarketFeatures['intensityVolatility'] | null> {
    if (!previousIntensities || previousIntensities.length === 0) {
      return null;
    }

    const intensities = previousIntensities.filter((intensity) => intensity !== null && intensity !== undefined);
    if (intensities.length === 0) {
      return null;
    }

    const latestIntensity = intensities[0];
    const maxIntensity = Math.max(...intensities);
    const minIntensity = Math.min(...intensities);
    const intensityVolatility = maxIntensity - minIntensity;

    // intensity 변화 추세 계산
    let intensityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (intensities.length >= 2) {
      const recentChange = intensities[0] - intensities[1];
      const threshold = 0.05; // 5%p
      if (recentChange >= threshold) {
        intensityTrend = 'increasing';
      } else if (recentChange <= -threshold) {
        intensityTrend = 'decreasing';
      } else {
        // 최근 3개 배치의 추세 확인
        if (intensities.length >= 3) {
          const avgChange = (intensities[0] - intensities[2]) / 2;
          if (avgChange >= threshold) {
            intensityTrend = 'increasing';
          } else if (avgChange <= -threshold) {
            intensityTrend = 'decreasing';
          }
        }
      }
    }

    // 최근 intensity 변화율 계산
    const intensityChangeRate = intensities.length >= 2 ? intensities[0] - intensities[1] : 0;

    // intensity 안정성 점수 계산 (0-100, 낮을수록 변동이 큼)
    // 변동성이 작을수록 높은 점수
    const volatilityScore = Math.max(0, 100 - intensityVolatility * 100); // 변동성 0.1당 10점 감소
    const changeScore = Math.max(0, 100 - Math.abs(intensityChangeRate) * 100); // 변화율 0.1당 10점 감소
    const intensityStability = (volatilityScore + changeScore) / 2;

    return {
      latestIntensity,
      intensityTrend,
      intensityVolatility,
      intensityChangeRate,
      intensityStability: Math.round(intensityStability * 100) / 100,
      batchCount: intensities.length,
    };
  }

  /**
   * 이전 추론 데이터 가져오기
   *
   * - 최근 7일 이내의 추론 결과를 조회합니다.
   *
   * @param symbol 종목 심볼
   * @returns 이전 추론 결과 배열
   */
  private async fetchRecentRecommendations(symbol: string): Promise<AllocationRecommendation[]> {
    try {
      return await AllocationRecommendation.getRecent({
        symbol,
        createdAt: new Date(Date.now() - ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG.recentDateLimit),
        count: ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG.recent,
      });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.features.recentRecommendationsFailed', { args: { symbol } }), error);
      return [];
    }
  }

  /**
   * 마켓 데이터 범례 문자열
   */
  public readonly MARKET_DATA_LEGEND =
    `범례: s=symbol, p=price, c24=change24h%, v24=volume24h(M), rsi=RSI14, ` +
    `macd={m:macd,s:signal,h:histogram}, ma={20:SMA20,50:SMA50}, ` +
    `bb={u:upper,l:lower,pb:percentB}, atr=normalizedATR, vol=volatility, liq=liquidityScore, pos=pricePosition, ` +
    `pred={tp:trendPersistence,pa:priceAccel,va:volumeAccel,conf:confidence,ms:momentumStrength,targets={b:bullish,be:bearish,n:neutral}}, ` +
    `intensityVol={li:latestIntensity,it:intensityTrend,iv:intensityVolatility,icr:intensityChangeRate,is:intensityStability,bc:batchCount}`;

  /**
   * 마켓 데이터 템플릿
   */
  private readonly MARKET_DATA_TEMPLATE = `[{{symbol}}] P: {{price}}, C: {{changePercent}}%, V: {{volumeM}}M, MCap: {{marketCapM}}M
- RSI(14): {{rsi14}}, Stoch(K/D): {{stochK}}%/{{stochD}}%, Williams%R: {{williamsR}}%, MFI: {{mfi}}, CCI: {{cci}}
- MACD(v/s/h): {{macdValue}}/{{macdSignal}}/{{macdHist}}
- SMA(20/50/200): {{sma20}}/{{sma50}}/{{sma200}}
- BB(u/m/l): {{bbUpper}}/{{bbMiddle}}/{{bbLower}}, %B: {{bbPercent}}%
- ATR(14): {{atr14}}, Volatility: {{volatility}}%, VWAP: {{vwap}}
- OBV(trend/sig): {{obvTrend}}/{{obvSignal}}
- Support/Resistance: {{support1}}/{{resistance1}}
- Trend(type/str): {{trendType}}/{{trendStrength}}, Divergence: {{divergence}}
- Prediction: TP={{trendPersistence}}%, PA={{priceAccel}}, VA={{volumeAccel}}, Conf={{confidence}}%, MS={{momentumStrength}}%
- Price Targets: Bullish={{targetBullish}}, Bearish={{targetBearish}}, Neutral={{targetNeutral}}
{{#if intensityVolatility}}
- Intensity Volatility: LI={{latestIntensity}}, IT={{intensityTrend}}, IV={{intensityVolatilityValue}}, ICR={{intensityChangeRate}}, IS={{intensityStability}}%, BC={{batchCount}}
{{/if}}`;

  /**
   * 마켓 특성 데이터를 압축 형태로 포맷팅
   *
   * - Handlebars 템플릿을 사용하여 시장 데이터를 포맷팅합니다.
   * - AI 추론 프롬프트에 사용하기 위한 형식으로 변환합니다.
   *
   * @param marketFeatures 시장 특성 데이터 배열
   * @returns 포맷팅된 시장 데이터 문자열
   */
  public formatMarketData(marketFeatures: Array<MarketFeatures | null>): string {
    const template = Handlebars.compile(this.MARKET_DATA_TEMPLATE);

    return marketFeatures
      .filter((feature) => feature && feature.symbol)
      .map((feature) => {
        const context = {
          symbol: feature.symbol,
          price: feature.price ?? 0,
          changePercent: feature.priceChangePercent24h ?? 0,
          volumeM: (feature.volume24h ?? 0) / 1000000,
          marketCapM: (feature.marketCap ?? 0) / 1000000,
          rsi14: feature.rsi14 ?? 0,
          stochK: feature.stochastic?.percentK ?? 0,
          stochD: feature.stochastic?.percentD ?? 0,
          williamsR: feature.williamsR ?? 0,
          mfi: feature.mfi ?? 0,
          cci: feature.cci ?? 0,
          macdValue: feature.macd?.macd ?? 0,
          macdSignal: feature.macd?.signal ?? 0,
          macdHist: feature.macd?.histogram ?? 0,
          sma20: feature.sma?.sma20 ?? 0,
          sma50: feature.sma?.sma50 ?? 0,
          sma200: feature.sma?.sma200 ?? 0,
          bbUpper: feature.bollingerBands?.upper ?? 0,
          bbMiddle: feature.bollingerBands?.middle ?? 0,
          bbLower: feature.bollingerBands?.lower ?? 0,
          bbPercent: feature.bollingerBands?.percentB ?? 0,
          atr14: feature.atr?.atr14 ?? 0,
          volatility: feature.volatility ?? 0,
          vwap: feature.vwap ?? 0,
          obvTrend: feature.obv?.trend ?? 0,
          obvSignal: feature.obv?.signal || 'neutral',
          support1: feature.supportResistance?.support1 ?? 0,
          resistance1: feature.supportResistance?.resistance1 ?? 0,
          trendType: feature.patterns?.trend || 'sideways',
          trendStrength: feature.patterns?.strength ?? 0,
          divergence: feature.patterns?.divergence || 'none',
          trendPersistence: feature.prediction?.trendPersistence ?? 50,
          priceAccel: feature.prediction?.priceAcceleration ?? 0,
          volumeAccel: feature.prediction?.volumeAcceleration ?? 0,
          confidence: feature.prediction?.confidence ?? 50,
          momentumStrength: feature.prediction?.momentumStrength ?? 50,
          targetBullish: feature.prediction?.priceTargets?.bullish ?? 0,
          targetBearish: feature.prediction?.priceTargets?.bearish ?? 0,
          targetNeutral: feature.prediction?.priceTargets?.neutral ?? 0,
          intensityVolatility: feature.intensityVolatility || null,
          latestIntensity: feature.intensityVolatility?.latestIntensity ?? 0,
          intensityTrend: feature.intensityVolatility?.intensityTrend || 'stable',
          intensityVolatilityValue: feature.intensityVolatility?.intensityVolatility ?? 0,
          intensityChangeRate: feature.intensityVolatility?.intensityChangeRate ?? 0,
          intensityStability: feature.intensityVolatility?.intensityStability ?? 100,
          batchCount: feature.intensityVolatility?.batchCount ?? 0,
        };
        return template(context);
      })
      .join('\n');
  }
}
