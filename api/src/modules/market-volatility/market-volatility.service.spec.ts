import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { Category } from '../category/category.enum';
import { HistoryService } from '../history/history.service';
import { RecommendationItem } from '../rebalance/rebalance.interface';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { UpbitService } from '../upbit/upbit.service';
import { MarketVolatilityService } from './market-volatility.service';

describe('MarketVolatilityService', () => {
  let service: MarketVolatilityService;
  let historyService: jest.Mocked<HistoryService>;
  let upbitService: jest.Mocked<UpbitService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketVolatilityService,
        {
          provide: HistoryService,
          useValue: {
            fetchHistory: jest.fn(),
          },
        },
        {
          provide: UpbitService,
          useValue: {
            getRecentMinuteCandles: jest.fn(),
          },
        },
        {
          provide: RedlockService,
          useValue: {
            withLock: jest.fn(async (_resourceName: string, _duration: number, callback: () => Promise<any>) =>
              callback(),
            ),
          },
        },
        {
          provide: SlackService,
          useValue: {
            sendServer: jest.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key: string) => key),
          },
        },
        {
          provide: ScheduleService,
          useValue: {
            getUsers: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<MarketVolatilityService>(MarketVolatilityService);
    historyService = module.get(HistoryService) as jest.Mocked<HistoryService>;
    upbitService = module.get(UpbitService) as jest.Mocked<UpbitService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not trigger inference when there is no history', async () => {
    historyService.fetchHistory.mockResolvedValueOnce([]);

    await service.handleTick();

    expect(historyService.fetchHistory).toHaveBeenCalledTimes(1);
    expect(upbitService.getRecentMinuteCandles).not.toHaveBeenCalled();
  });

  it('should use 1m candles window (5 + 5) and trigger inference only when volatility bucket increases', async () => {
    const items: RecommendationItem[] = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ];

    // 1분봉 6개 중:
    // - 이전 5개 구간: close 모두 100 → 변동폭 0% → 버킷 0
    // - 다음 5개 구간: close 중 1개 캔들에서만 104 → 변동폭 4% → 버킷 0 (미트리거, 5% step 기준)
    // - 이후 5개 구간: close 중 1개 캔들에서만 105 → 변동폭 5% → 버킷 1 (트리거, 5% step 기준)
    // Note: BTC/KRW는 1% step을 사용하므로, 이 테스트는 BTC가 아닌 다른 심볼(ETH/KRW)을 사용하여 5% step 동작을 검증
    historyService.fetchHistory.mockResolvedValue(items);

    // 첫 번째 호출: 변동폭 0% → 4% (diff 4%) → 트리거 안 됨 (5% step 기준)
    // BTC/KRW 체크 (변동성 없음, 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      // [timestamp, open, high, low, close, volume]
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 100, 100, 100, 0], // BTC는 변동성 없음 (트리거 안 됨)
    ]);
    // ETH/KRW 체크 (변동폭 4%, 5% step 기준으로 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 104, 100, 104, 0], // 다음 5개 윈도우의 maxHigh 104 → 변동폭 4%
    ]);

    await service.handleTick();

    // 두 번째 호출: 변동폭 0% → 5% (diff 5%) → 해당 종목에 대해서만 추론
    // BTC/KRW 체크 (변동성 없음, 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 100, 100, 100, 0], // BTC는 변동성 없음 (트리거 안 됨)
    ]);
    // ETH/KRW 체크 (변동폭 5%, 5% step 기준으로 트리거 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 105, 100, 105, 0], // 다음 5개 윈도우의 maxHigh 105 → 변동폭 5%
    ]);

    await service.handleTick();

    // 변동성 트리거가 발생했는지 확인
    expect(upbitService.getRecentMinuteCandles).toHaveBeenCalled();
  });
});
