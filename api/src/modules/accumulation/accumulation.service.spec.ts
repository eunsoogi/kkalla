import { Test, TestingModule } from '@nestjs/testing';

import { AccumulationService } from './accumulation.service';

describe('AccumulationService', () => {
  let service: AccumulationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccumulationService],
    }).compile();

    service = module.get<AccumulationService>(AccumulationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
