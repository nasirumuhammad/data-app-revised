import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { IdentityType } from '../enums/identity-verification-type';

@Entity('identity_verifications')
@Index(['userId', 'createdAt'])
@Index(['identityType'])
export class IdentityVerification extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: IdentityType })
  identityType!: IdentityType;

  @Column({ type: 'varchar', length: 12 })
  identityNumber!: string;

  @ManyToOne(() => User, (user) => user.identityVerifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;
}
