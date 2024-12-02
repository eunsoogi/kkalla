import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { I18nService } from 'nestjs-i18n';

import { Permission } from '../../permission/permission.enum';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private i18n: I18nService,
  ) {}

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
      throw new ForbiddenException(this.i18n.t('logging.auth.permission.no_user'));
    }

    const userPermissions = user.roles?.flatMap((role) => role.permissions) || [];
    const hasPermission = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException(
        this.i18n.t('logging.auth.permission.insufficient_permissions', {
          args: { permissions: requiredPermissions.join(', ') },
        }),
      );
    }

    return true;
  }
}
