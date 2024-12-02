import { Controller, Get, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from './permission.enum';
import { PermissionService } from './permission.service';

@Controller('/api/v1/permissions')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_ROLES)
  getAllPermissions() {
    return this.permissionService.getAllPermissions();
  }
}
