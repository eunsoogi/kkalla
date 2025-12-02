import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { TradeService } from './trade.service';

describe('TradeService', () => {
  let service: TradeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        {
          provide: I18nService,
          useValue: {
            t: jest.fn().mockReturnValue('test message'),
          },
        },
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TradeService는 이제 조회 기능만 제공하므로
  // 실제 조회 테스트는 통합 테스트에서 수행
});
