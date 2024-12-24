import { Test, TestingModule } from '@nestjs/testing';

import { ProfitController } from './profit.controller';
import { ProfitService } from './profit.service';

describe('ProfitController', () => {
  let controller: ProfitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfitController],
      providers: [ProfitService],
    }).compile();

    controller = module.get<ProfitController>(ProfitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
