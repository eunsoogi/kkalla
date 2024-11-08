import { Test, TestingModule } from '@nestjs/testing';

import { OpenaiController } from './openai.controller';
import { OpenaiService } from './openai.service';

describe('OpenaiController', () => {
  let controller: OpenaiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenaiController],
      providers: [OpenaiService],
    }).compile();

    controller = module.get<OpenaiController>(OpenaiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
