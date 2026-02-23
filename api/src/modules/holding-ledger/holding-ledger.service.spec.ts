import { Test, TestingModule } from '@nestjs/testing';

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
});
