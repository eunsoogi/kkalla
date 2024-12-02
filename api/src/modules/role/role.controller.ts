import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permission } from '../user/user.enum';
import { RoleDto } from './dto/role.dto';
import { RoleService } from './role.service';

@Controller('/api/v1/roles')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_USERS)
  public async getRoles(): Promise<RoleDto[]> {
    return this.roleService.findAll();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  public async createRole(@Body() roleDto: RoleDto): Promise<RoleDto> {
    return this.roleService.create(roleDto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  public async updateRole(@Param('id') id: string, @Body() roleDto: RoleDto): Promise<RoleDto> {
    return this.roleService.update(id, roleDto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  public async deleteRole(@Param('id') id: string): Promise<void> {
    return this.roleService.delete(id);
  }
}
