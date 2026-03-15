import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';

import { Category } from '../category/category.enum';
import { HoldingLedgerService } from '../holding-ledger/holding-ledger.service';
import { BlacklistService } from './blacklist.service';
import { Blacklist } from './entities/blacklist.entity';

describe('BlacklistService', () => {
  let service: BlacklistService;
  let holdingLedgerService: jest.Mocked<Pick<HoldingLedgerService, 'removeHoldingsForAllUsers'>>;
  let dataSource: { transaction: jest.Mock };
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let manager: {
    getRepository: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOneBy: jest.fn(),
    };
    manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistService,
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
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

    repository.save.mockResolvedValue(savedBlacklist);

    const result = await service.save({
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });

    expect(result).toBe(savedBlacklist);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith({
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
    });
    expect(holdingLedgerService.removeHoldingsForAllUsers).toHaveBeenCalledWith([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
    ], manager);
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

    repository.findOneBy.mockResolvedValue(existingBlacklist);
    repository.save.mockResolvedValue(updatedBlacklist);

    const result = await service.update('blacklist-1', {
      symbol: 'ETH/KRW',
    });

    expect(result).toBe(updatedBlacklist);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'blacklist-1' });
    expect(holdingLedgerService.removeHoldingsForAllUsers).toHaveBeenCalledWith([
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
    ], manager);
  });

  it('throws when updating a missing blacklist entry', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.update('missing', { symbol: 'BTC/KRW' })).rejects.toBeInstanceOf(NotFoundException);
    expect(holdingLedgerService.removeHoldingsForAllUsers).not.toHaveBeenCalled();
  });
});
