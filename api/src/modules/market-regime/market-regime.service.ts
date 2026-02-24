import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';
import { URL } from 'url';

import { formatDate, parseTimestamp } from '@/utils/date';

import { CacheService } from '../cache/cache.service';
import { ErrorService } from '../error/error.service';
import {
  AltcoinIndexClassification,
  BtcDominanceClassification,
  CompactFeargreed,
  Feargreed,
  FeargreedApiResponse,
  FeargreedCachePayload,
  MarketRegimeCachePayload,
  MarketRegimeSnapshot,
} from './market-regime.interface';

interface CoinMarketCapOverviewDetailResponse {
  status?: {
    timestamp?: string;
  };
  data?: {
    marketDominance?: {
      btcPercentage?: number;
    };
    altcoinIndex?: {
      index?: number;
    };
  };
}

@Injectable()
export class MarketRegimeService {
  private readonly logger = new Logger(MarketRegimeService.name);

  private readonly FEARGREED_API_URL = 'https://api.alternative.me/fng/';
  private readonly CMC_OVERVIEW_DETAIL_API_URL =
    'https://api.coinmarketcap.com/data-api/v3/global-metrics/crypto/overview/detail';

  private readonly STALE_THRESHOLD_MS = 60 * 60 * 1000;
  private readonly RECENT_SNAPSHOT_WINDOW_MS = 60 * 60 * 1000;
  private readonly BTC_DOMINANCE_NEUTRAL_FALLBACK = 55;
  private readonly ALTCOIN_INDEX_NEUTRAL_FALLBACK = 50;
  private readonly BTC_DOMINANCE_ALT_FRIENDLY_MAX = 50;
  private readonly BTC_DOMINANCE_TRANSITION_MAX = 60;
  private readonly ALTCOIN_INDEX_BITCOIN_SEASON_MAX = 25;
  private readonly ALTCOIN_INDEX_ALT_SEASON_MIN = 75;

  private readonly MARKET_REGIME_LAST_SUCCESS_CACHE_KEY = 'market-regime:last-success:v1';
  private readonly MARKET_REGIME_LAST_SUCCESS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

  private readonly FEARGREED_LAST_SUCCESS_CACHE_KEY = 'market-regime:feargreed:last-success:v1';
  private readonly FEARGREED_LAST_SUCCESS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

  private inflightSnapshotPromise: Promise<MarketRegimeSnapshot> | null = null;

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  public async getSnapshot(): Promise<MarketRegimeSnapshot> {
    if (this.inflightSnapshotPromise) {
      return this.inflightSnapshotPromise;
    }

    this.inflightSnapshotPromise = this.loadSnapshotWithRecentCache();

    try {
      return await this.inflightSnapshotPromise;
    } finally {
      this.inflightSnapshotPromise = null;
    }
  }

  private async loadSnapshot(): Promise<MarketRegimeSnapshot> {
    try {
      const liveSnapshot = await this.fetchLiveSnapshot();
      if (liveSnapshot.source === 'live' || liveSnapshot.source === 'cache_fallback') {
        await this.cacheLastSuccessSnapshot(liveSnapshot);
      }
      return liveSnapshot;
    } catch (error) {
      const cachedPayload = await this.cacheService.get<MarketRegimeCachePayload>(
        this.MARKET_REGIME_LAST_SUCCESS_CACHE_KEY,
      );
      const cachedSnapshot = this.buildSnapshotFromCache(cachedPayload, 'cache_fallback');
      if (cachedSnapshot) {
        this.logger.warn(
          this.i18n.t('logging.marketRegime.snapshot_live_failed_fallback_cache', {
            args: {
              asOf: cachedSnapshot.asOf.toISOString(),
            },
          }),
        );
        return cachedSnapshot;
      }

      throw new Error(
        `Failed to load market regime snapshot and no cached fallback is available: ${this.errorService.getErrorMessage(
          error,
        )}`,
      );
    }
  }

  private async loadSnapshotWithRecentCache(): Promise<MarketRegimeSnapshot> {
    const recentSnapshot = await this.getRecentSnapshotFromCacheSafe();
    if (recentSnapshot) {
      return recentSnapshot;
    }

    return this.loadSnapshot();
  }

  private async loadFeargreed(): Promise<Feargreed> {
    try {
      const liveFeargreed = await this.fetchLiveFeargreed();
      await this.cacheLastSuccessFeargreed(liveFeargreed);
      return liveFeargreed;
    } catch (error) {
      const cachedPayload = await this.cacheService.get<FeargreedCachePayload>(this.FEARGREED_LAST_SUCCESS_CACHE_KEY);
      const cachedFeargreed = this.buildFeargreedFromCache(cachedPayload);
      if (cachedFeargreed) {
        this.logger.warn(
          this.i18n.t('logging.marketRegime.feargreed_live_failed_fallback_cache', {
            args: {
              asOf: new Date(cachedFeargreed.timestamp * 1000).toISOString(),
            },
          }),
        );
        return cachedFeargreed;
      }

      throw new Error(
        `Failed to load feargreed and no cached fallback is available: ${this.errorService.getErrorMessage(error)}`,
      );
    }
  }

  private async fetchLiveSnapshot(): Promise<MarketRegimeSnapshot> {
    const cachedPayload = await this.cacheService.get<MarketRegimeCachePayload>(
      this.MARKET_REGIME_LAST_SUCCESS_CACHE_KEY,
    );
    const feargreed = await this.fetchFeargreedForSnapshot();

    try {
      const overview = await this.fetchLiveOverviewFromCoinMarketCap();
      return this.buildSnapshot({
        btcDominance: overview.btcDominance,
        altcoinIndex: overview.altcoinIndex,
        feargreed: feargreed ?? this.normalizeFeargreed(cachedPayload?.feargreed),
        asOf: overview.asOf,
        source: 'live',
      });
    } catch (error) {
      const fallbackAsOf = this.parseCacheAsOf(cachedPayload?.asOf);
      const hasSnapshotCache =
        Number.isFinite(cachedPayload?.btcDominance) &&
        Number.isFinite(cachedPayload?.altcoinIndex) &&
        fallbackAsOf != null;

      if (!hasSnapshotCache) {
        if (feargreed) {
          const feargreedAsOf = new Date(feargreed.timestamp * 1000);
          this.logger.warn(
            this.i18n.t('logging.marketRegime.cmc_overview_failed_using_feargreed_fallback', {
              args: {
                asOf: feargreedAsOf.toISOString(),
                message: this.errorService.getErrorMessage(error),
              },
            }),
          );

          return this.buildSnapshot({
            btcDominance: this.BTC_DOMINANCE_NEUTRAL_FALLBACK,
            altcoinIndex: this.ALTCOIN_INDEX_NEUTRAL_FALLBACK,
            feargreed,
            asOf: feargreedAsOf,
            source: 'cache_fallback',
          });
        }

        throw error;
      }

      this.logger.warn(
        this.i18n.t('logging.marketRegime.cmc_overview_failed_using_cache', {
          args: {
            asOf: fallbackAsOf.toISOString(),
            message: this.errorService.getErrorMessage(error),
          },
        }),
      );

      return this.buildSnapshot({
        btcDominance: Number(cachedPayload?.btcDominance),
        altcoinIndex: Number(cachedPayload?.altcoinIndex),
        feargreed: feargreed ?? this.normalizeFeargreed(cachedPayload?.feargreed),
        asOf: fallbackAsOf,
        source: 'cache_fallback',
      });
    }
  }

  private async fetchLiveOverviewFromCoinMarketCap(): Promise<{
    btcDominance: number;
    altcoinIndex: number;
    asOf: Date;
  }> {
    const operation = () =>
      firstValueFrom(
        this.httpService.get<CoinMarketCapOverviewDetailResponse>(this.CMC_OVERVIEW_DETAIL_API_URL, {
          params: {
            range: '1d',
          },
        }),
      );

    const { data } = await this.errorService.retry(operation, {
      maxRetries: 2,
      retryDelay: 1000,
    });

    const btcDominance = Number(data?.data?.marketDominance?.btcPercentage);
    const altcoinIndex = Number(data?.data?.altcoinIndex?.index);
    if (!Number.isFinite(btcDominance) || !Number.isFinite(altcoinIndex)) {
      throw new Error('Invalid market regime response from CoinMarketCap overview endpoint');
    }

    const asOf = this.parseCacheAsOf(data?.status?.timestamp) ?? new Date(Date.now());

    return {
      btcDominance: this.roundPercent(btcDominance),
      altcoinIndex: this.roundPercent(altcoinIndex),
      asOf,
    };
  }

  private async fetchFeargreedForSnapshot(): Promise<Feargreed | null> {
    try {
      return await this.loadFeargreed();
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.marketRegime.snapshot_feargreed_load_failed', {
          args: {
            message: this.errorService.getErrorMessage(error),
          },
        }),
      );
      return null;
    }
  }

  private async fetchLiveFeargreed(): Promise<Feargreed> {
    const url = new URL(this.FEARGREED_API_URL);
    url.searchParams.set('limit', '2');

    const operation = () => firstValueFrom(this.httpService.get<FeargreedApiResponse>(url.toString()));
    const { data } = await this.errorService.retry(operation, {
      maxRetries: 2,
      retryDelay: 1000,
    });

    return this.toSingleFeargreed(data);
  }

  private toSingleFeargreed(response: FeargreedApiResponse): Feargreed {
    if (!response?.data || response.data.length < 1) {
      throw new Error('Invalid feargreed response');
    }

    const latest = response.data[0];
    const timestamp = parseTimestamp(latest.timestamp);
    const index = Number.parseInt(latest.value, 10);
    const timeUntilUpdate = Number.parseInt(latest.time_until_update || '0', 10);

    if (!Number.isFinite(index) || !Number.isFinite(timestamp)) {
      throw new Error('Invalid feargreed numeric fields');
    }

    let diff = 0;
    if (response.data.length > 1) {
      const previous = Number.parseInt(response.data[1].value, 10);
      if (Number.isFinite(previous)) {
        diff = index - previous;
      }
    }

    return {
      index,
      classification: latest.value_classification,
      timestamp,
      date: formatDate(timestamp),
      timeUntilUpdate: Number.isFinite(timeUntilUpdate) ? timeUntilUpdate : 0,
      diff,
    };
  }

  private async cacheLastSuccessSnapshot(snapshot: MarketRegimeSnapshot): Promise<void> {
    const payload: MarketRegimeCachePayload = {
      btcDominance: snapshot.btcDominance,
      altcoinIndex: snapshot.altcoinIndex,
      feargreed: snapshot.feargreed,
      asOf: snapshot.asOf.toISOString(),
    };

    await this.cacheService.set(
      this.MARKET_REGIME_LAST_SUCCESS_CACHE_KEY,
      payload,
      this.MARKET_REGIME_LAST_SUCCESS_CACHE_TTL_SECONDS,
    );
  }

  private async getRecentSnapshotFromCacheSafe(): Promise<MarketRegimeSnapshot | null> {
    try {
      const cachedPayload = await this.cacheService.get<MarketRegimeCachePayload>(
        this.MARKET_REGIME_LAST_SUCCESS_CACHE_KEY,
      );
      const cachedSnapshot = this.buildSnapshotFromCache(cachedPayload, 'live');
      if (!cachedSnapshot) {
        return null;
      }

      const ageMs = Math.max(0, Date.now() - cachedSnapshot.asOf.getTime());
      if (ageMs > this.RECENT_SNAPSHOT_WINDOW_MS) {
        return null;
      }

      return cachedSnapshot;
    } catch {
      return null;
    }
  }

  private async cacheLastSuccessFeargreed(item: Feargreed): Promise<void> {
    const payload: FeargreedCachePayload = {
      index: item.index,
      classification: item.classification,
      timestamp: item.timestamp,
      date: item.date,
      timeUntilUpdate: item.timeUntilUpdate,
      diff: Number.isFinite(item.diff) ? Number(item.diff) : 0,
    };

    await this.cacheService.set(
      this.FEARGREED_LAST_SUCCESS_CACHE_KEY,
      payload,
      this.FEARGREED_LAST_SUCCESS_CACHE_TTL_SECONDS,
    );
  }

  private buildSnapshotFromCache(
    payload: MarketRegimeCachePayload | null,
    source: 'live' | 'cache_fallback',
  ): MarketRegimeSnapshot | null {
    if (!payload) {
      return null;
    }

    const asOf = new Date(payload.asOf);
    if (Number.isNaN(asOf.getTime())) {
      return null;
    }

    return this.buildSnapshot({
      btcDominance: payload.btcDominance,
      altcoinIndex: payload.altcoinIndex,
      feargreed: this.normalizeFeargreed(payload.feargreed),
      asOf,
      source,
    });
  }

  private parseCacheAsOf(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private buildFeargreedFromCache(payload: FeargreedCachePayload | null): Feargreed | null {
    if (!payload) {
      return null;
    }

    if (!Number.isFinite(payload.index) || !Number.isFinite(payload.timestamp)) {
      return null;
    }

    return {
      index: payload.index,
      classification: payload.classification,
      timestamp: payload.timestamp,
      date: payload.date || formatDate(payload.timestamp),
      timeUntilUpdate: Number.isFinite(payload.timeUntilUpdate) ? payload.timeUntilUpdate : 0,
      diff: Number.isFinite(payload.diff) ? payload.diff : 0,
    };
  }

  private buildSnapshot(params: {
    btcDominance: number;
    altcoinIndex: number;
    feargreed?: Feargreed | CompactFeargreed | null;
    asOf: Date;
    source: 'live' | 'cache_fallback';
  }): MarketRegimeSnapshot {
    const normalizedAsOf = params.asOf instanceof Date ? params.asOf : new Date(params.asOf);
    const staleAgeMs = Math.max(0, Date.now() - normalizedAsOf.getTime());

    return {
      btcDominance: this.roundPercent(params.btcDominance),
      btcDominanceClassification: this.resolveBtcDominanceClassification(params.btcDominance),
      altcoinIndex: this.roundPercent(params.altcoinIndex),
      altcoinIndexClassification: this.resolveAltcoinIndexClassification(params.altcoinIndex),
      feargreed: this.normalizeFeargreed(params.feargreed),
      asOf: normalizedAsOf,
      source: params.source,
      isStale: staleAgeMs > this.STALE_THRESHOLD_MS,
      staleAgeMinutes: Math.floor(staleAgeMs / (60 * 1000)),
    };
  }

  private normalizeFeargreed(input: Feargreed | CompactFeargreed | null | undefined): Feargreed | null {
    if (!input) {
      return null;
    }

    if (!Number.isFinite(input.index) || !Number.isFinite(input.timestamp)) {
      return null;
    }

    const timestamp = Number(input.timestamp);

    return {
      index: Number(input.index),
      classification: input.classification ?? '',
      timestamp,
      date: 'date' in input && typeof input.date === 'string' ? input.date : formatDate(timestamp),
      timeUntilUpdate:
        'timeUntilUpdate' in input && Number.isFinite(input.timeUntilUpdate) ? Number(input.timeUntilUpdate) : 0,
      diff: 'diff' in input && Number.isFinite(input.diff) ? Number(input.diff) : 0,
    };
  }

  private roundPercent(value: number): number {
    const normalized = Math.max(0, Math.min(100, value));
    return Number(normalized.toFixed(2));
  }

  private resolveBtcDominanceClassification(value: number): BtcDominanceClassification {
    if (value <= this.BTC_DOMINANCE_ALT_FRIENDLY_MAX) {
      return 'altcoin_friendly';
    }
    if (value <= this.BTC_DOMINANCE_TRANSITION_MAX) {
      return 'transition';
    }
    return 'bitcoin_dominance';
  }

  private resolveAltcoinIndexClassification(value: number): AltcoinIndexClassification {
    if (value <= this.ALTCOIN_INDEX_BITCOIN_SEASON_MAX) {
      return 'bitcoin_season';
    }
    if (value < this.ALTCOIN_INDEX_ALT_SEASON_MIN) {
      return 'neutral';
    }
    return 'altcoin_season';
  }
}
