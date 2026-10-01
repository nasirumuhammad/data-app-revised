import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ProviderCapability } from '../enums/provider-capability.enum';

@Entity('provider_capabilities')
@Index(['providerId', 'capability'], { unique: true })
export class ProviderCapabilityEntity extends BaseEntity {
  @Column()
  providerId: string;

  @Column({
    type: 'enum',
    enum: ProviderCapability,
  })
  capability: ProviderCapability;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ type: 'jsonb', default: {} })
  configuration: Record<string, unknown>;
}
