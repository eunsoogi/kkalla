import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { OAuth2Client, TokenInfo } from 'google-auth-library';
import { Strategy } from 'passport-http-bearer';

import { User } from '../users/entities/user.entity';
import { UserService } from '../users/user.service';

@Injectable()
export class GoogleTokenStrategy extends PassportStrategy(Strategy, 'google-token') {
  private googleClient: OAuth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

  constructor(private readonly userService: UserService) {
    super();
  }

  public async validate(accessToken: string): Promise<User> {
    let userInfo: TokenInfo;

    try {
      userInfo = await this.googleClient.getTokenInfo(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid access token.');
    }

    return await this.userService.findOrCreate({ email: userInfo.email });
  }
}