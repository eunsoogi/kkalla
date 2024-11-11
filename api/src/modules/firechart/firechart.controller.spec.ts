import { Test, TestingModule } from '@nestjs/testing';

import { FirechartController } from './firechart.controller';
import { FirechartService } from './firechart.service';

describe('FirechartController', () => {
  let controller: FirechartController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirechartController],
      providers: [FirechartService],
    }).compile();

    controller = module.get<FirechartController>(FirechartController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
