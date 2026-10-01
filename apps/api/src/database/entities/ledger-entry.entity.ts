import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';

@Entity('ledger_entries')
@Index(['walletId', 'createdAt'])
export class LedgerEntry extends BaseEntity {
  @Column()
  walletId!: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryType,
  })
  type!: LedgerEntryType;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  amount!: string;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  balanceBefore!: string;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  balanceAfter!: string;

  @Column({ nullable: true })
  transactionId!: string | null;

  @Column({ nullable: true })
  reference!: string | null;

  @Column({ nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
