import { Test, TestingModule } from '@nestjs/testing';

import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

describe('InferenceController', () => {
  let controller: InferenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InferenceController],
      providers: [InferenceService],
    }).compile();

    controller = module.get<InferenceController>(InferenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
