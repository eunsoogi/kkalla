import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PaginatedItem } from '../item/item.interface';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { Permission } from './user.enum';
import { UserService } from './user.service';

@Controller('/api/v1/users')
@UseGuards(GoogleTokenAuthGuard, PermissionGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_USERS)
  public async get(@Query() params: GetUsersDto): Promise<PaginatedItem<UserDto>> {
    return this.userService.paginate(params);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_USERS)
  public async getUser(@Param('id') id: string): Promise<UserDto> {
    return this.userService.findById(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  public async createUser(@Body() body: UserDto): Promise<UserDto> {
    return this.userService.create(body);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  public async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto): Promise<UserDto> {
    return this.userService.update(id, body);
  }
}
