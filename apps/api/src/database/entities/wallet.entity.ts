import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { WalletStatus } from '../enums/wallet-status.enum';

@Entity('wallets')
@Index(['userId'], { unique: true })
export class Wallet extends BaseEntity {
  @Column()
  userId!: string;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0,
  })
  balance!: string;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0,
  })
  availableBalance!: string;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
    default: 0,
  })
  reservedBalance!: string;

  @Column({ default: 'NGN' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status!: WalletStatus;
}
