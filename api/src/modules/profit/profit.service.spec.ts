import { Test, TestingModule } from '@nestjs/testing';

import { ProfitService } from './profit.service';

describe('ProfitService', () => {
  let service: ProfitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfitService],
    }).compile();

    service = module.get<ProfitService>(ProfitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
