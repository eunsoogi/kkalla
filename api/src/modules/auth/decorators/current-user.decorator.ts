import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { User } from '@/modules/user/entities/user.entity';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User => {
  const { user } = ctx.switchToHttp().getRequest();
  return user;
});
