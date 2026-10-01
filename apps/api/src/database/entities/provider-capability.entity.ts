import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { ProviderCapability } from '../enums/provider-capability.enum';
import { Provider } from './provider.entity';

@Entity('provider_capabilities')
@Index(['providerId', 'capability'], { unique: true })
export class ProviderCapabilityEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  providerId!: string;

  @ManyToOne(() => Provider, (provider) => provider.capabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'providerId' })
  provider!: Relation<Provider>;

  @Column({
    type: 'enum',
    enum: ProviderCapability,
  })
  capability!: ProviderCapability;

  @Column({ default: true })
  isEnabled!: boolean;

  /** Lower number = tried first by the routing service. */
  @Column({ type: 'int', default: 1 })
  priority!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  configuration!: Record<string, unknown>;
}
