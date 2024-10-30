import { Test, TestingModule } from '@nestjs/testing';

import { FeargreedService } from './feargreed.service';

describe('FeargreedService', () => {
  let service: FeargreedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeargreedService],
    }).compile();

    service = module.get<FeargreedService>(FeargreedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
