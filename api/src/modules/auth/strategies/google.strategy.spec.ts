import { GoogleTokenStrategy } from './google.strategy';

describe('GoogleTokenStrategy', () => {
  const user = { id: 'user-1', email: 'cached@example.com' } as any;
  const userService = {
    findOrCreate: jest.fn().mockResolvedValue(user),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };

  let strategy: GoogleTokenStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new GoogleTokenStrategy(userService as any, cacheService as any);
  });

  it('should reuse cached token info and skip google token validation', async () => {
    cacheService.get.mockResolvedValue({ email: 'cached@example.com' });
    const tokenInfoSpy = jest.spyOn((strategy as any).googleClient, 'getTokenInfo').mockResolvedValue({
      email: 'remote@example.com',
    });

    const result = await strategy.validate('access-token');

    expect(tokenInfoSpy).not.toHaveBeenCalled();
    expect(userService.findOrCreate).toHaveBeenCalledWith({ email: 'cached@example.com' });
    expect(cacheService.set).not.toHaveBeenCalled();
    expect(result).toBe(user);
  });

  it('should cache token info on cache miss', async () => {
    cacheService.get.mockResolvedValue(null);
    const tokenInfoSpy = jest.spyOn((strategy as any).googleClient, 'getTokenInfo').mockResolvedValue({
      email: 'remote@example.com',
    });

    await strategy.validate('access-token');

    expect(tokenInfoSpy).toHaveBeenCalledWith('access-token');
    expect(userService.findOrCreate).toHaveBeenCalledWith({ email: 'remote@example.com' });
    expect(cacheService.set).toHaveBeenCalledTimes(1);

    const [cacheKey, payload, ttl] = cacheService.set.mock.calls[0];
    expect(cacheKey).toMatch(/^auth:google-token:[a-f0-9]{64}$/);
    expect(String(cacheKey)).not.toContain('access-token');
    expect(payload).toEqual({ email: 'remote@example.com' });
    expect(ttl).toBe(60);
  });
});
