import { Column, Entity, OneToMany, Relation } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ProviderStatus } from '../enums/provider-status.enum';
import { ProviderCapabilityEntity } from './provider-capability.entity';

@Entity('providers')
export class Provider extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({
    type: 'enum',
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status!: ProviderStatus;

  @Column({ default: true })
  isEnabled!: boolean;

  @OneToMany(
    () => ProviderCapabilityEntity,
    (capability) => capability.provider,
  )
  capabilities!: Relation<ProviderCapabilityEntity[]>;
}
