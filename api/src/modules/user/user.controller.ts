import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { PaginatedItem } from '@/modules/item/item.interface';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { GetUsersDto } from './dto/get-users.dto';
import { UserDto } from './dto/user.dto';
import { Permission } from './user.enum';
import { UserService } from './user.service';

@Controller('/api/v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.VIEW_USERS)
  public async get(@Query() params: GetUsersDto): Promise<PaginatedItem<UserDto>> {
    return this.userService.paginate(params);
  }
}
