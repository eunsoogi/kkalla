import { Test, TestingModule } from '@nestjs/testing';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  const dashboardService = {
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: dashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  it('should return dashboard summary', async () => {
    dashboardService.getSummary.mockResolvedValue({ generatedAt: new Date().toISOString() });

    const result = await controller.getSummary({ id: 'user-1' } as any);

    expect(dashboardService.getSummary).toHaveBeenCalledWith({ id: 'user-1' });
    expect(result).toEqual({ generatedAt: expect.any(String) });
  });
});
