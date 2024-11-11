import { Test, TestingModule } from '@nestjs/testing';

import { FirechartService } from './firechart.service';

describe('FirechartService', () => {
  let service: FirechartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirechartService],
    }).compile();

    service = module.get<FirechartService>(FirechartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
