import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ApikeyTypes {
  OPENAI = 'OPENAI',
  UPBIT = 'UPBIT',
}

@Entity({
  orderBy: {
    id: 'ASC',
  },
})
export class Apikey extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: ApikeyTypes, nullable: false, unique: true })
  type!: ApikeyTypes;

  @Column({ nullable: false })
  apiKey!: string;

  @Column()
  secretKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
