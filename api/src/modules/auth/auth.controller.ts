import { Controller, Get, UseGuards } from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RoleDto } from './dto/role.dto';
import { GoogleTokenAuthGuard } from './guards/google.guard';

@Controller('api/v1/auth')
@UseGuards(GoogleTokenAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('roles')
  public getRoles(@CurrentUser() user: User): RoleDto[] {
    return this.authService.getRoles(user);
  }
}
