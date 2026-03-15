import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { Category } from '../category/category.enum';
import { HoldingLedgerService } from '../holding-ledger/holding-ledger.service';
import { BlacklistService } from './blacklist.service';
import { Blacklist } from './entities/blacklist.entity';

describe('BlacklistService', () => {
  let service: BlacklistService;
  let holdingLedgerService: jest.Mocked<Pick<HoldingLedgerService, 'removeHoldingsForAllUsers'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistService,
        {
          provide: HoldingLedgerService,
          useValue: {
            removeHoldingsForAllUsers: jest.fn(),
          },
        },
      ],
    })
      .useMocker((token) => {
        if (token && typeof token === 'function' && token.name === 'I18nService') {
          return {
            t: jest.fn().mockReturnValue('not found'),
          };
        }

        return {};
      })
      .compile();

    service = module.get<BlacklistService>(BlacklistService);
    holdingLedgerService = module.get(HoldingLedgerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('removes matching holdings for all users after save', async () => {
    const savedBlacklist = Object.assign(new Blacklist(), {
      id: 'blacklist-1',
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });

    jest.spyOn(Blacklist, 'save').mockResolvedValue(savedBlacklist);

    const result = await service.save({
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });

    expect(result).toBe(savedBlacklist);
    expect(holdingLedgerService.removeHoldingsForAllUsers).toHaveBeenCalledWith([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
    ]);
  });

  it('removes matching holdings for all users after update', async () => {
    const existingBlacklist = Object.assign(new Blacklist(), {
      id: 'blacklist-1',
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });
    const updatedBlacklist = Object.assign(new Blacklist(), {
      id: 'blacklist-1',
      symbol: 'ETH/KRW',
      category: Category.COIN_MAJOR,
    });

    jest.spyOn(Blacklist, 'findOneBy').mockResolvedValue(existingBlacklist);
    jest.spyOn(Blacklist, 'save').mockResolvedValue(updatedBlacklist);

    const result = await service.update('blacklist-1', {
      symbol: 'ETH/KRW',
    });

    expect(result).toBe(updatedBlacklist);
    expect(holdingLedgerService.removeHoldingsForAllUsers).toHaveBeenCalledWith([
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
    ]);
  });

  it('throws when updating a missing blacklist entry', async () => {
    jest.spyOn(Blacklist, 'findOneBy').mockResolvedValue(null);

    await expect(service.update('missing', { symbol: 'BTC/KRW' })).rejects.toBeInstanceOf(NotFoundException);
    expect(holdingLedgerService.removeHoldingsForAllUsers).not.toHaveBeenCalled();
  });
});
