import { BaseEntity, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Sequence extends BaseEntity {
  @PrimaryGeneratedColumn('increment')
  value: number;
}
