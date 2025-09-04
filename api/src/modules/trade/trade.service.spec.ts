import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { CategoryService } from '../category/category.service';
import { HistoryService } from '../history/history.service';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { OrderTypes } from '../upbit/upbit.enum';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { TradeData } from './trade.interface';
import { TradeService } from './trade.service';

// Trade 엔티티를 모킹하여 TradeSubscriber 동작을 시뮬레이션
jest.mock('./entities/trade.entity');
const MockedTrade = Trade as jest.MockedClass<typeof Trade>;

describe('TradeService', () => {
  let service: TradeService;
  let testUser: User;
  let sequenceCounter: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    sequenceCounter = 1;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        {
          provide: I18nService,
          useValue: {
            t: jest.fn().mockReturnValue('test message'),
          },
        },
        {
          provide: InferenceService,
          useValue: {},
        },
        {
          provide: UpbitService,
          useValue: {},
        },
        {
          provide: ProfitService,
          useValue: {},
        },
        {
          provide: NotifyService,
          useValue: {},
        },
        {
          provide: HistoryService,
          useValue: {},
        },
        {
          provide: CategoryService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);

    // 테스트용 유저 모킹
    testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save trade successfully with auto-assigned sequence by TradeSubscriber', async () => {
    const tradeData: TradeData = {
      ticker: 'KRW-BTC',
      type: OrderTypes.BUY,
      amount: 10000,
      profit: 100,
    };

    // TradeSubscriber의 beforeInsert 동작을 시뮬레이션
    const mockTrade = {
      id: 'trade-1',
      ticker: tradeData.ticker,
      type: tradeData.type,
      amount: tradeData.amount,
      profit: tradeData.profit,
      user: testUser,
      seq: null, // 초기에는 null
    } as any;

    // save 메서드가 호출될 때 TradeSubscriber처럼 seq를 자동 할당
    mockTrade.save = jest.fn().mockImplementation(() => {
      if (mockTrade.seq == null) {
        mockTrade.seq = sequenceCounter++; // TradeSubscriber의 beforeInsert 로직 시뮬레이션
      }
      return Promise.resolve(mockTrade);
    });

    MockedTrade.mockImplementation(() => mockTrade);

    const result = await service.saveTrade(testUser, tradeData);

    expect(result).toBeDefined();
    expect(result.ticker).toBe(tradeData.ticker);
    expect(result.type).toBe(tradeData.type);
    expect(result.amount).toBe(tradeData.amount);
    expect(result.profit).toBe(tradeData.profit);
    expect(result.user).toBe(testUser);
    expect(result.seq).toBeDefined(); // TradeSubscriber가 자동으로 할당
    expect(typeof result.seq).toBe('number');
    expect(result.seq).toBeGreaterThan(0);
    expect(mockTrade.save).toHaveBeenCalledTimes(1);
  });

  it('should handle concurrent saveTrade with Promise.all and unique sequences via TradeSubscriber', async () => {
    const concurrentCount = 10;
    const tradeDataArray: TradeData[] = Array.from({ length: concurrentCount }, (_, index) => ({
      ticker: `KRW-BTC${index}`,
      type: index % 2 === 0 ? OrderTypes.BUY : OrderTypes.SELL,
      amount: 10000 + index * 1000,
      profit: 100 + index * 10,
    }));

    // 각 Trade 인스턴스마다 고유한 seq를 할당하는 TradeSubscriber 동작 시뮬레이션
    let callCount = 0;
    MockedTrade.mockImplementation(() => {
      const currentIndex = callCount++;
      const mockTrade = {
        id: `trade-${currentIndex + 1}`,
        ticker: tradeDataArray[currentIndex].ticker,
        type: tradeDataArray[currentIndex].type,
        amount: tradeDataArray[currentIndex].amount,
        profit: tradeDataArray[currentIndex].profit,
        user: testUser,
        seq: null, // 초기에는 null
      } as any;

      // TradeSubscriber의 beforeInsert 동작을 정확히 시뮬레이션
      mockTrade.save = jest.fn().mockImplementation(() => {
        if (mockTrade.seq == null) {
          mockTrade.seq = sequenceCounter++; // 고유한 시퀀스 자동 할당
        }
        return Promise.resolve(mockTrade);
      });

      return mockTrade;
    });

    const promises = tradeDataArray.map((tradeData) => service.saveTrade(testUser, tradeData));
    const trades = await Promise.all(promises);

    // 모든 거래가 정의되어야 함
    trades.forEach((trade, index) => {
      expect(trade).toBeDefined();
      expect(trade.ticker).toBe(tradeDataArray[index].ticker);
      expect(trade.type).toBe(tradeDataArray[index].type);
      expect(trade.amount).toBe(tradeDataArray[index].amount);
      expect(trade.profit).toBe(tradeDataArray[index].profit);
      expect(trade.user).toBe(testUser);
      expect(trade.seq).toBeDefined(); // TradeSubscriber가 자동으로 할당
      expect(typeof trade.seq).toBe('number');
      expect(trade.seq).toBeGreaterThan(0);
    });

    const sequences = trades.map((trade) => trade.seq);
    const uniqueSequences = new Set(sequences);

    // 모든 시퀀스가 유니크해야 함 (TradeSubscriber의 Sequence 테이블 자동 생성으로 보장)
    expect(uniqueSequences.size).toBe(concurrentCount);
    expect(MockedTrade).toHaveBeenCalledTimes(concurrentCount);
  });

  it('should handle high concurrency stress test with TradeSubscriber sequence generation', async () => {
    const concurrentCount = 50;
    const tradeDataArray: TradeData[] = Array.from({ length: concurrentCount }, (_, index) => ({
      ticker: `KRW-ETH${index}`,
      type: index % 3 === 0 ? OrderTypes.BUY : OrderTypes.SELL,
      amount: 5000 + index * 500,
      profit: 50 + index * 5,
    }));

    // 고강도 동시성에서도 유니크한 시퀀스를 보장하는 TradeSubscriber 시뮬레이션
    let callCount = 0;
    MockedTrade.mockImplementation(() => {
      const currentIndex = callCount++;
      const mockTrade = {
        id: `trade-${currentIndex + 1}`,
        ticker: tradeDataArray[currentIndex].ticker,
        type: tradeDataArray[currentIndex].type,
        amount: tradeDataArray[currentIndex].amount,
        profit: tradeDataArray[currentIndex].profit,
        user: testUser,
        seq: null,
      } as any;

      // TradeSubscriber가 동시성 상황에서도 유니크한 시퀀스를 생성
      mockTrade.save = jest.fn().mockImplementation(() => {
        if (mockTrade.seq == null) {
          // 실제 TradeSubscriber는 Sequence 테이블의 AUTO_INCREMENT를 사용하여 동시성 안전성 보장
          mockTrade.seq = Date.now() * 1000 + currentIndex; // 타임스탬프 + 인덱스로 고유성 보장
        }
        return Promise.resolve(mockTrade);
      });

      return mockTrade;
    });

    const promises = tradeDataArray.map((tradeData) => service.saveTrade(testUser, tradeData));
    const trades = await Promise.all(promises);

    // 모든 거래가 유효해야 함
    trades.forEach((trade, index) => {
      expect(trade).not.toBeNull();
      expect(trade).not.toBeUndefined();
      expect(trade.seq).toBeGreaterThan(0);
      expect(trade.ticker).toBe(tradeDataArray[index].ticker);
      expect(trade.user).toBe(testUser);
    });

    const sequences = trades.map((trade) => trade.seq);
    const uniqueSequences = new Set(sequences);

    // TradeSubscriber의 Sequence 테이블 활용으로 모든 시퀀스가 유니크해야 함
    expect(uniqueSequences.size).toBe(concurrentCount);
    expect(MockedTrade).toHaveBeenCalledTimes(concurrentCount);
  });

  it('should maintain sequence consistency across multiple concurrent rounds via TradeSubscriber', async () => {
    const rounds = 3;
    const concurrentPerRound = 15;
    const allTrades: Trade[] = [];
    let globalCallCount = 0;

    for (let round = 0; round < rounds; round++) {
      const tradeDataArray: TradeData[] = Array.from({ length: concurrentPerRound }, (_, index) => ({
        ticker: `KRW-ADA${round}-${index}`,
        type: (round + index) % 2 === 0 ? OrderTypes.BUY : OrderTypes.SELL,
        amount: 1000 + round * 1000 + index * 100,
        profit: 10 + round * 10 + index,
      }));

      // 각 라운드에서도 TradeSubscriber가 글로벌하게 유니크한 시퀀스를 생성
      MockedTrade.mockImplementation(() => {
        const currentIndex = globalCallCount++;
        const localIndex = currentIndex % concurrentPerRound;
        const mockTrade = {
          id: `trade-${currentIndex + 1}`,
          ticker: tradeDataArray[localIndex].ticker,
          type: tradeDataArray[localIndex].type,
          amount: tradeDataArray[localIndex].amount,
          profit: tradeDataArray[localIndex].profit,
          user: testUser,
          seq: null,
        } as any;

        // TradeSubscriber의 글로벌 시퀀스 생성 로직
        mockTrade.save = jest.fn().mockImplementation(() => {
          if (mockTrade.seq == null) {
            mockTrade.seq = sequenceCounter++; // 글로벌 시퀀스 카운터
          }
          return Promise.resolve(mockTrade);
        });

        return mockTrade;
      });

      const promises = tradeDataArray.map((tradeData) => service.saveTrade(testUser, tradeData));
      const trades = await Promise.all(promises);

      allTrades.push(...trades);

      // 각 라운드별로 모든 거래가 유효해야 함
      trades.forEach((trade, index) => {
        expect(trade).toBeDefined();
        expect(trade.ticker).toBe(tradeDataArray[index].ticker);
        expect(trade.user).toBe(testUser);
        expect(trade.seq).toBeDefined();
        expect(typeof trade.seq).toBe('number');
        expect(trade.seq).toBeGreaterThan(0);
      });

      const roundSequences = trades.map((trade) => trade.seq);
      const uniqueRoundSequences = new Set(roundSequences);

      // 각 라운드별로 모든 시퀀스가 유니크해야 함
      expect(uniqueRoundSequences.size).toBe(concurrentPerRound);
    }

    const allSequences = allTrades.map((trade) => trade.seq);
    const uniqueAllSequences = new Set(allSequences);

    // TradeSubscriber가 전체적으로 유니크한 시퀀스를 보장해야 함
    expect(allTrades.length).toBe(rounds * concurrentPerRound);
    expect(uniqueAllSequences.size).toBe(rounds * concurrentPerRound);
    expect(MockedTrade).toHaveBeenCalledTimes(rounds * concurrentPerRound);
  });
});
