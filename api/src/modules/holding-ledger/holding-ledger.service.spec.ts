import { Test, TestingModule } from '@nestjs/testing';

import { Category } from '../category/category.enum';
import { HoldingLedger } from './entities/holding-ledger.entity';
import { HoldingLedgerService } from './holding-ledger.service';

describe('HoldingLedgerService', () => {
  let service: HoldingLedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HoldingLedgerService],
    }).compile();

    service = module.get<HoldingLedgerService>(HoldingLedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('removes matching holdings for all users', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const where = jest.fn().mockReturnValue({ execute });
    const deleteFn = jest.fn().mockReturnValue({ where });

    jest.spyOn(HoldingLedger, 'createQueryBuilder').mockReturnValue({
      delete: deleteFn,
    } as never);

    await service.removeHoldingsForAllUsers([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
    ]);

    expect(HoldingLedger.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(where).toHaveBeenNthCalledWith(1, 'symbol = :symbol AND category = :category', {
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });
    expect(where).toHaveBeenNthCalledWith(2, 'symbol = :symbol AND category = :category', {
      symbol: 'ETH/KRW',
      category: Category.COIN_MAJOR,
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
