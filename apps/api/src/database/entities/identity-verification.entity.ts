import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { IdentityVerificationStatus } from '../enums/identity-status.enum';
import { ProviderCapability } from '../enums/provider-capability.enum';

@Entity('identity_verifications')
@Index(['userId', 'capability'])
export class IdentityVerification extends BaseEntity {
  @Column()
  userId!: string;

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

  @Column({ nullable: true })
  providerId!: string | null;

  @Column({ nullable: true })
  providerReference!: string | null;

  @Column({ nullable: true })
  verifiedAt!: Date | null;

  @Column({ nullable: true })
  failureReason!: string | null;
}
