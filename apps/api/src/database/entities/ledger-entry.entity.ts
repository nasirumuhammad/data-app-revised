import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { Transaction } from './transaction.entity';
import { Wallet } from './wallet.entity';

@Entity('ledger_entries')
@Index(['walletId', 'createdAt'])
// A transaction can be debited, reversed, etc. at most once per entry type,
// which makes double-debit / double-refund bugs fail at the database level.
@Index(['transactionId', 'type'], {
  unique: true,
  where: '"transactionId" IS NOT NULL',
})
export class LedgerEntry extends BaseEntity {
  @Column({ type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.ledgerEntries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'walletId' })
  wallet!: Relation<Wallet>;

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

  @Column({ type: 'uuid', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => Transaction, (transaction) => transaction.ledgerEntries, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Relation<Transaction> | null;

  @Column({ type: 'varchar', nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
