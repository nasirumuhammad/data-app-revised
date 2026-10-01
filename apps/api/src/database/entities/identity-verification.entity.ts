import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { IdentityVerificationStatus } from '../enums/identity-status.enum';
import { ProviderCapability } from '../enums/provider-capability.enum';
import { Provider } from './provider.entity';
import { User } from './user.entity';

@Entity('identity_verifications')
@Index(['userId', 'capability'])
export class IdentityVerification extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.identityVerifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({
    type: 'enum',
    enum: ProviderCapability,
  })
  capability!: ProviderCapability;

  @Column({
    type: 'enum',
    enum: IdentityVerificationStatus,
    default: IdentityVerificationStatus.PENDING,
  })
  status!: IdentityVerificationStatus;

  @Column({ type: 'uuid', nullable: true })
  providerId!: string | null;

  @ManyToOne(() => Provider, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'providerId' })
  provider!: Relation<Provider> | null;

  @Column({ type: 'varchar', nullable: true })
  providerReference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason!: string | null;
}
