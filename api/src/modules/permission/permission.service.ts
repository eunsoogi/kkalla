import { Injectable } from '@nestjs/common';

import { Permission } from './permission.enum';

@Injectable()
export class PermissionService {
  getAllPermissions(): string[] {
    return Object.values(Permission);
  }

  isValidPermission(permission: string): boolean {
    return Object.values(Permission).includes(permission as Permission);
  }
}
