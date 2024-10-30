import { Module } from '@nestjs/common';

import { UserModule } from '../users/user.module';
import { GoogleTokenStrategy } from './google.strategy';

@Module({
  imports: [UserModule],
  providers: [GoogleTokenStrategy],
})
export class AuthModule {}
