import { Injectable } from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { RoleDto } from './dto/role.dto';

@Injectable()
export class AuthService {
  public getRoles(user: User): RoleDto[] {
    return (user.roles || []).map(RoleDto.from);
  }
}
