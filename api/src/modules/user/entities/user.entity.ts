import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  Like,
  ManyToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SortDirection } from '@/modules/item/item.enum';
import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { Role } from '@/modules/role/entities/role.entity';
import { ULID_COLUMN_OPTIONS, assignUlidIfMissing } from '@/utils/id';

import { UserFilter } from '../user.interface';

@Entity({
  orderBy: {
    createdAt: 'ASC',
  },
})
export class User extends BaseEntity {
  @PrimaryColumn({
    ...ULID_COLUMN_OPTIONS,
  })
  id: string;

  @BeforeInsert()
  private assignId(): void {
    assignUlidIfMissing(this);
  }

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  email: string;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable()
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static async findByEmail(email: string): Promise<User> {
    return this.findOne({ where: { email } });
  }

  public static async paginate(request: ItemRequest & UserFilter): Promise<PaginatedItem<User>> {
    const where: any = {};

    if (request.search) {
      where.email = Like(`%${request.search}%`);
    }

    const sortDirection = request.sortDirection ?? SortDirection.DESC;

    const findOptions = {
      relations: ['roles'],
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
