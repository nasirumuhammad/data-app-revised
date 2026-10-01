import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';

export enum AuthProvider {
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
}

@Entity('auth_identities')
@Index(['provider', 'providerAccountId'], { unique: true })
export class AuthIdentity extends BaseEntity {
  @Column()
  userId!: string;

  @Column({
    type: 'enum',
    enum: AuthProvider,
  })
  provider!: AuthProvider;

  @Column({ nullable: true })
  providerAccountId!: string | null;

  @Column({ nullable: true })
  passwordHash!: string | null;
}
