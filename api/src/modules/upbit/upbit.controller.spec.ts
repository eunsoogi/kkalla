import { Test, TestingModule } from '@nestjs/testing';

import { UpbitController } from './upbit.controller';
import { UpbitService } from './upbit.service';

describe('UpbitController', () => {
  let controller: UpbitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UpbitController],
      providers: [UpbitService],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<UpbitController>(UpbitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
