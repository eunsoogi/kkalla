import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PaginatedItem } from '../item/item.interface';
import { Permission } from '../permission/permission.enum';
import { CreateRoleDto } from './dto/create-role.dto';
import { GetRolesDto } from './dto/get-roles.dto';
import { RoleDto } from './dto/role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { RoleService } from './role.service';

@Controller('/api/v1/roles')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('all')
  @RequirePermissions(Permission.VIEW_ROLES)
  public async getAll(): Promise<RoleDto[]> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_ROLES)
  public async getById(@Param('id') id: string): Promise<RoleDto> {
    const role = await this.roleService.findById(id);
    return new RoleDto(role);
  }

  @Get()
  @RequirePermissions(Permission.VIEW_ROLES)
  public async get(@Query() params: GetRolesDto): Promise<PaginatedItem<RoleDto>> {
    return this.roleService.paginate(params);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  public async post(@Body() data: CreateRoleDto): Promise<RoleDto> {
    return this.roleService.create(data);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  public async put(@Param('id') id: string, @Body() data: UpdateRoleDto): Promise<RoleDto> {
    return this.roleService.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  public async delete(@Param('id') id: string): Promise<void> {
    return this.roleService.delete(id);
  }

  public async paginate(params: GetRolesDto): Promise<PaginatedItem<RoleDto>> {
    const roles = await Role.paginate(params);

    return {
      ...roles,
      items: roles.items.map((role) => new RoleDto(role)),
    };
  }
}
