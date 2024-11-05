import { Test, TestingModule } from '@nestjs/testing';

import { FeargreedController } from './feargreed.controller';

describe('FeargreedController', () => {
  let controller: FeargreedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeargreedController],
    }).compile();

    controller = module.get<FeargreedController>(FeargreedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
