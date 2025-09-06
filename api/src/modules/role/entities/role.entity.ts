import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Like,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SortDirection } from '@/modules/item/item.enum';
import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Permission } from '../../permission/permission.enum';
import { User } from '../../user/entities/user.entity';
import { RoleFilter } from '../role.interface';

@Entity()
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: false,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  description: string;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  permissions: Permission[];

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async paginate(request: ItemRequest & RoleFilter): Promise<PaginatedItem<Role>> {
    const where: any = {};

    if (request.search) {
      where.name = Like(`%${request.search}%`);
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      where,
      order: {
        updatedAt: sortDirection,
      },
      skip: (request.page - 1) * request.perPage,
      take: request.perPage,
    };

    const [items, total] = await this.findAndCount(findOptions);

    return {
      items,
      total,
      page: request.page,
      perPage: request.perPage,
      totalPages: Math.ceil(total / request.perPage),
    };
  }
}
