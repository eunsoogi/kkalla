import { Test, TestingModule } from '@nestjs/testing';

import { BlacklistService } from './blacklist.service';

describe('BlacklistService', () => {
  let service: BlacklistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlacklistService],
    }).compile();

    service = module.get<BlacklistService>(BlacklistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
