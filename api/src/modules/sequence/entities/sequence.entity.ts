import { BaseEntity, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Sequence extends BaseEntity {
  @PrimaryGeneratedColumn('increment', {
    type: 'bigint',
  })
  value: number;
}
