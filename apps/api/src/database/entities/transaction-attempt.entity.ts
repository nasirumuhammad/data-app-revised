import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { TransactionAttemptStatus } from '../enums/transaction-attempt-status.enum';
import { Provider } from './provider.entity';
import { Transaction } from './transaction.entity';

@Entity('transaction_attempts')
@Index(['transactionId', 'attemptNumber'], { unique: true })
@Index(['providerId', 'status'])
export class TransactionAttempt extends BaseEntity {
  @Column({ type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.attempts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Relation<Transaction>;

  @Column({ type: 'uuid' })
  providerId!: string;

  @ManyToOne(() => Provider, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'providerId' })
  provider!: Relation<Provider>;

  @Column({ type: 'int' })
  attemptNumber!: number;

  @Column({
    type: 'enum',
    enum: TransactionAttemptStatus,
    default: TransactionAttemptStatus.PENDING,
  })
  status!: TransactionAttemptStatus;

  @Column({ type: 'varchar', nullable: true })
  providerReference!: string | null;

  @Column({ type: 'varchar', nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
