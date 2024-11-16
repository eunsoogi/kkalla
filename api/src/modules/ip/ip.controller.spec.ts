import { Test, TestingModule } from '@nestjs/testing';

import { IpController } from './ip.controller';
import { IpService } from './ip.service';

describe('IpController', () => {
  let controller: IpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IpController],
      providers: [IpService],
    }).compile();

    controller = module.get<IpController>(IpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
