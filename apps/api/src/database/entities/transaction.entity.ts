import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { ServiceType } from '../enums/service-type.enum';
import { LedgerEntry } from './ledger-entry.entity';
import { Provider } from './provider.entity';
import { TransactionAttempt } from './transaction-attempt.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

@Entity('transactions')
@Index(['userId', 'createdAt'])
// Client-supplied key: a retried request returns the original transaction
// instead of creating (and charging for) a second one.
@Index(['userId', 'idempotencyKey'], { unique: true })
@Index(['status', 'createdAt'])
export class Transaction extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet!: Relation<Wallet>;

  /** Provider that finally fulfilled the order (set on success). */
  @Column({ type: 'uuid', nullable: true })
  providerId!: string | null;

  @ManyToOne(() => Provider, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'providerId' })
  provider!: Relation<Provider> | null;

  @Column({
    type: 'enum',
    enum: ServiceType,
  })
  serviceType!: ServiceType;

  /** What the customer is buying: phone number, meter number, smartcard... */
  @Column({ type: 'varchar', nullable: true })
  recipient!: string | null;

  /** Our internal product/plan code, resolved to a provider code at routing. */
  @Column({ type: 'varchar', nullable: true })
  productCode!: string | null;

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
    default: 0,
  })
  fee!: string;

  @Column({ default: 'NGN' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ unique: true })
  reference!: string;

  @Column({ type: 'varchar' })
  idempotencyKey!: string;

  @Column({ type: 'varchar', nullable: true })
  providerReference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @OneToMany(() => TransactionAttempt, (attempt) => attempt.transaction)
  attempts!: Relation<TransactionAttempt[]>;

  @OneToMany(() => LedgerEntry, (entry) => entry.transaction)
  ledgerEntries!: Relation<LedgerEntry[]>;
}
