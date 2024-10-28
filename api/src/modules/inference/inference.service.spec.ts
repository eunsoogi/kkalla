import { Test, TestingModule } from '@nestjs/testing';

import { InferenceService } from './inference.service';

describe('InferenceService', () => {
  let service: InferenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InferenceService],
    }).compile();

    service = module.get<InferenceService>(InferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
