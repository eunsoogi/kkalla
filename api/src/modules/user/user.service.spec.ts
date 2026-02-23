import { NotFoundException } from '@nestjs/common';

import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let i18n: { t: jest.Mock };

  beforeEach(() => {
    i18n = {
      t: jest.fn().mockReturnValue('user-not-found'),
    };
    service = new UserService(i18n as any, {} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should query by both ulid and legacy id', async () => {
    const user = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      legacyId: '3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7',
      roles: [],
    } as unknown as User;

    const findOneSpy = jest.spyOn(User, 'findOne').mockResolvedValueOnce(user);

    const result = await service.findById('3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7');

    expect(result).toBe(user);
    expect(findOneSpy).toHaveBeenCalledWith({
      where: [{ id: '3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7' }, { legacyId: '3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7' }],
      relations: ['roles'],
    });
  });

  it('should throw not found when id does not exist in both columns', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null);

    await expect(service.findById('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(i18n.t).toHaveBeenCalledWith('logging.user.error.not_found', {
      args: { id: 'missing-id' },
    });
  });
});
