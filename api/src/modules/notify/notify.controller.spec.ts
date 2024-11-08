import { Test, TestingModule } from '@nestjs/testing';

import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

describe('NotifyController', () => {
  let controller: NotifyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotifyController],
      providers: [NotifyService],
    }).compile();

    controller = module.get<NotifyController>(NotifyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
