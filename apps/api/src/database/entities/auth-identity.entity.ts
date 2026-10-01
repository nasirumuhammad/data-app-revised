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

export enum AuthProvider {
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
}

@Entity('auth_identities')
@Index(['provider', 'providerAccountId'], { unique: true })
@Index(['userId'])
export class AuthIdentity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.authIdentities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({
    type: 'enum',
    enum: AuthProvider,
  })
  provider!: AuthProvider;

  @Column({ type: 'varchar', nullable: true })
  providerAccountId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;
}
