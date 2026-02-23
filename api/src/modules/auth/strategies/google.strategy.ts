import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { OAuth2Client, TokenInfo } from 'google-auth-library';
import { I18nService } from 'nestjs-i18n';
import { createHash } from 'node:crypto';
import { Strategy } from 'passport-http-bearer';

import { CacheService } from '@/modules/cache/cache.service';
import { User } from '@/modules/user/entities/user.entity';
import { UserService } from '@/modules/user/user.service';

interface CachedGoogleTokenInfo {
  email: string;
}

@Injectable()
export class GoogleTokenStrategy extends PassportStrategy(Strategy, 'google-token') {
  private readonly logger = new Logger(GoogleTokenStrategy.name);
  private readonly TOKEN_CACHE_TTL_SECONDS = 60;

  private readonly googleClient: OAuth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  public async validate(accessToken: string): Promise<User> {
    const cacheKey = this.buildTokenCacheKey(accessToken);
    const cached = await this.cacheService.get<CachedGoogleTokenInfo>(cacheKey);

    if (cached?.email) {
      return this.userService.findOrCreate({ email: cached.email });
    }

    let userInfo: TokenInfo;

    try {
      userInfo = await this.googleClient.getTokenInfo(accessToken);
    } catch (err) {
      this.logger.error(this.i18n.t('logging.auth.google.token_info_failed'), err);
      throw new UnauthorizedException(err);
    }

    if (!userInfo?.email) {
      throw new UnauthorizedException('Token does not include email');
    }

    await this.cacheService.set<CachedGoogleTokenInfo>(
      cacheKey,
      { email: userInfo.email },
      this.TOKEN_CACHE_TTL_SECONDS,
    );

    return this.userService.findOrCreate({ email: userInfo.email });
  }

  private buildTokenCacheKey(accessToken: string): string {
    const tokenHash = createHash('sha256').update(accessToken).digest('hex');
    return `auth:google-token:${tokenHash}`;
  }
}
