import { Module } from '@nestjs/common';

import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenStrategy } from './strategies/google.strategy';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [GoogleTokenStrategy, AuthService],
})
export class AuthModule {}
