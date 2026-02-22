import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenStrategy } from './strategies/google.strategy';

@Module({
  imports: [UserModule, CacheModule],
  controllers: [AuthController],
  providers: [GoogleTokenStrategy, AuthService],
})
export class AuthModule {}
