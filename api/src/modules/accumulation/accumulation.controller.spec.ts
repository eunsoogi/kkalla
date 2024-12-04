import { Test, TestingModule } from '@nestjs/testing';

import { AccumulationController } from './accumulation.controller';
import { AccumulationService } from './accumulation.service';

describe('AccumulationController', () => {
  let controller: AccumulationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccumulationController],
      providers: [AccumulationService],
    }).compile();

    controller = module.get<AccumulationController>(AccumulationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
