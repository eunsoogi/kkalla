import { Test, TestingModule } from '@nestjs/testing';

import { BlacklistController } from './blacklist.controller';
import { BlacklistService } from './blacklist.service';

describe('BlacklistController', () => {
  let controller: BlacklistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlacklistController],
      providers: [BlacklistService],
    }).compile();

    controller = module.get<BlacklistController>(BlacklistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
