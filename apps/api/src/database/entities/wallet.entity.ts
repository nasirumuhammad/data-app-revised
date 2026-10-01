import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { WalletStatus } from '../enums/wallet-status.enum';
import { LedgerEntry } from './ledger-entry.entity';
import { User } from './user.entity';

@Entity('wallets')
@Check('CHK_wallets_balance_non_negative', '"balance" >= 0')
@Check('CHK_wallets_available_non_negative', '"availableBalance" >= 0')
@Check('CHK_wallets_reserved_non_negative', '"reservedBalance" >= 0')
export class Wallet extends BaseEntity {
  // One-to-one join column is already unique at the database level.
  @Column({ type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, (user) => user.wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

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

  @OneToMany(() => LedgerEntry, (entry) => entry.wallet)
  ledgerEntries!: Relation<LedgerEntry[]>;
}
