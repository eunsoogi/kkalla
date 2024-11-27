import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Permission } from '../../user/user.enum';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  public async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredPermissions) {
      return true;
    }

    const { user } = ctx.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No user found in request');
    }

    const userPermissions = user.roles?.flatMap((role) => role.permissions) || [];
    const hasPermission = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException(`You don't have required permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
