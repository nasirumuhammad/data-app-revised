import { Column, Entity } from 'typeorm';

import { BaseEntity } from './base.entity';
import { ProviderStatus } from '../enums/provider-status.enum';

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
}
